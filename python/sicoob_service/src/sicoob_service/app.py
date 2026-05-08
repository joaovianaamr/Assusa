"""FastAPI: endpoints internos para o Node chamar o cliente Sicoob (boletos v3)."""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncGenerator
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


async def banking_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AsyncGenerator[BankingSicoobV3, None]:
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
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/boleto/registrar", dependencies=[AuthDep])
async def boleto_registrar(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.registrar_boleto(body)}


@app.post("/internal/boleto/segunda-via", dependencies=[AuthDep])
async def boleto_segunda_via(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.segunda_via_boleto(body)}


@app.post("/internal/boleto/consultar", dependencies=[AuthDep])
async def boleto_consultar(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.consultar_boleto(body)}


@app.post("/internal/boleto/baixa", dependencies=[AuthDep])
async def boleto_baixa(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.baixa_boleto(body)}


@app.post("/internal/boleto/listar", dependencies=[AuthDep])
async def boleto_listar(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.listar_boleto(body)}


@app.patch("/internal/boleto/alterar/{nosso_numero}", dependencies=[AuthDep])
async def boleto_alterar(
    nosso_numero: str,
    body: dict[str, Any],
    banking: BankingDep,
) -> dict[str, Any]:
    return {"ok": True, "result": banking.alterar_dados_boleto(body, nosso_numero)}


@app.post("/internal/webhook/cadastrar", dependencies=[AuthDep])
async def webhook_cadastrar(body: dict[str, Any], banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.cadastrar_webhook(body)}


@app.get("/internal/webhook/consultar", dependencies=[AuthDep])
async def webhook_consultar(
    banking: BankingDep,
    id_webhook: Annotated[str, Query(alias="idWebhook")],
) -> dict[str, Any]:
    return {"ok": True, "result": banking.consultar_webhook({"idWebhook": id_webhook})}


@app.patch("/internal/webhook/{id_webhook}", dependencies=[AuthDep])
async def webhook_alterar(
    id_webhook: str,
    body: dict[str, Any],
    banking: BankingDep,
) -> dict[str, Any]:
    return {"ok": True, "result": banking.alterar_webhook(body, id_webhook)}


@app.delete("/internal/webhook/{id_webhook}", dependencies=[AuthDep])
async def webhook_delete(id_webhook: str, banking: BankingDep) -> dict[str, Any]:
    return {"ok": True, "result": banking.delete_webhook(id_webhook)}


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
