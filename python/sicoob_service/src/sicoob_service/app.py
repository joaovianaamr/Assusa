"""FastAPI: endpoints internos para o Node chamar o cliente Sicoob (boletos v3)."""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from sicoob_service import database
from sicoob_service.banking_v3 import BankingSicoobV3
from sicoob_service.bootstrap import create_banking_client
from sicoob_service.exceptions import SicoobConfigError
from sicoob_service.settings import Settings, get_settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.database_url:
        database.init_pool(settings.database_url)
        logger.info("PostgreSQL: pool inicializado via lifespan")
    yield


app = FastAPI(title="Sicoob boletos (interno)", version="0.1.0", lifespan=lifespan)

# Token do Sicoob expira em 300s — renova com 1 minuto de margem
_TOKEN_TTL = 240
_cached_client: BankingSicoobV3 | None = None
_cached_at: float = 0.0


async def verify_internal_key(
    settings: Annotated[Settings, Depends(get_settings)],
    x_internal_api_key: Annotated[str | None, Header(alias="X-Internal-Api-Key")] = None,
) -> None:
    expected = (settings.internal_api_key or "").strip()
    if not expected:
        logger.warning("INTERNAL_API_KEY não definido — recusar tráfego interno")
        raise HTTPException(status_code=503, detail="Service misconfigured: INTERNAL_API_KEY")
    if (x_internal_api_key or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ── Por que as rotas abaixo são `def` e não `async def` ──────────────────────
# O cliente do Sicoob (`banking_v3`) é SÍNCRONO: usa httpx.Client e chega a
# chamar time.sleep() no retry de 429. Numa rota `async def`, isso roda dentro do
# event loop e bloqueia o servidor inteiro — o Node dispara 6 janelas em paralelo
# e elas eram atendidas uma de cada vez (medido: 1 requisição 0,09 s, 6 em
# paralelo 0,72 s, ou seja, a soma).
#
# Declarando `def`, o FastAPI executa a função num threadpool e a concorrência
# volta. Vale para banking_dependency também: ela renova o token via mTLS, que é
# o ponto mais caro de todos.
def banking_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Generator[BankingSicoobV3, None, None]:
    global _cached_client, _cached_at
    now = time.monotonic()
    if _cached_client is None or (now - _cached_at) > _TOKEN_TTL:
        if _cached_client is not None:
            _cached_client.close()
        try:
            _cached_client = create_banking_client(settings)
            _cached_at = now
        except SicoobConfigError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    yield _cached_client


BankingDep = Annotated[BankingSicoobV3, Depends(banking_dependency)]
AuthDep = Depends(verify_internal_key)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/boleto/registrar", dependencies=[AuthDep])
def boleto_registrar(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.registrar_boleto(body)}


@app.post("/internal/boleto/segunda-via", dependencies=[AuthDep])
def boleto_segunda_via(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.segunda_via_boleto(body)}


@app.post("/internal/boleto/consultar", dependencies=[AuthDep])
def boleto_consultar(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.consultar_boleto(body)}


@app.post("/internal/boleto/baixa", dependencies=[AuthDep])
def boleto_baixa(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.baixa_boleto(body)}


@app.post("/internal/boleto/listar", dependencies=[AuthDep])
def boleto_listar(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.listar_boleto(body)}


@app.get("/internal/boleto/faixas-nosso-numero", dependencies=[AuthDep])
def boleto_faixas_nosso_numero(
    banking: BankingDep,
    numeroCliente: int,
    codigoModalidade: int,
    quantidade: int,
    numeroContratoCobranca: int | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {
        "numeroCliente": numeroCliente,
        "codigoModalidade": codigoModalidade,
        "quantidade": quantidade,
    }
    if numeroContratoCobranca is not None:
        params["numeroContratoCobranca"] = numeroContratoCobranca
    return {"ok": True, "result": banking.consultar_faixas_nosso_numero(params)}


@app.patch("/internal/boleto/alterar/{nosso_numero}", dependencies=[AuthDep])
def boleto_alterar(
    nosso_numero: str,
    body: dict[str, Any],
    banking: BankingDep,
) -> dict[str, Any]:
    return {"ok": True, "result": banking.alterar_dados_boleto(body, nosso_numero)}


@app.post("/internal/webhook/cadastrar", dependencies=[AuthDep])
def webhook_cadastrar(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.cadastrar_webhook(body)}


@app.get("/internal/webhook/consultar", dependencies=[AuthDep])
def webhook_consultar(
    banking: BankingDep,
    id_webhook: Annotated[str | None, Query(alias="idWebhook")] = None,
) -> dict[str, Any]:
    params = {"idWebhook": id_webhook} if id_webhook else {}
    return {"ok": True, "result": banking.consultar_webhook(params)}


@app.patch("/internal/webhook/{id_webhook}", dependencies=[AuthDep])
def webhook_alterar(
    id_webhook: str,
    body: dict[str, Any],
    banking: BankingDep,
) -> dict[str, Any]:
    return {"ok": True, "result": banking.alterar_webhook(body, id_webhook)}


@app.get("/internal/webhook/{id_webhook}/solicitacoes", dependencies=[AuthDep])
def webhook_consultar_solicitacoes(
    id_webhook: str,
    banking: BankingDep,
    data_solicitacao: Annotated[str | None, Query(alias="dataSolicitacao")] = None,
    pagina: int = 1,
    codigo_situacao: Annotated[int | None, Query(alias="codigoSolicitacaoSituacao")] = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"pagina": pagina}
    if data_solicitacao:
        params["dataSolicitacao"] = data_solicitacao
    if codigo_situacao is not None:
        params["codigoSolicitacaoSituacao"] = codigo_situacao
    return {"ok": True, "result": banking.consultar_solicitacoes_webhook(id_webhook, params)}


@app.patch("/internal/webhook/{id_webhook}/reativar", dependencies=[AuthDep])
def webhook_reativar(id_webhook: str, banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.reativar_webhook(id_webhook)}


@app.delete("/internal/webhook/{id_webhook}", dependencies=[AuthDep])
def webhook_deletar(id_webhook: str, banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.deletar_webhook(id_webhook)}


@app.post("/interno/interacao", dependencies=[AuthDep])
def registrar_interacao(body: dict[str, Any]) -> dict[str, Any]:
    database.inserir(body["telefone"], body["evento"], body.get("cpf"), body.get("detalhes"))
    return {"ok": True}


@app.get("/interno/interacoes", dependencies=[AuthDep])
def listar_interacoes(
    telefone: str | None = None,
    cpf: str | None = None,
    evento: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    limite: int = 50,
) -> dict[str, Any]:
    rows = database.consultar(telefone, cpf, evento, data_inicio, data_fim, min(limite, 200))
    return {"ok": True, "result": rows}
