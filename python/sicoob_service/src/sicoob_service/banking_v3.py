"""
Port parcial de BankingSicoobV3.php (api-sicoob): cobrança v3 + webhooks cobrança.
PIX e movimentação v2 não estão no MVP.
"""

from __future__ import annotations

import functools
import json
import logging
import ssl
import time
from typing import Any

import httpx

from sicoob_service.token_v3 import TokenV3

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.0  # segundos; dobra a cada tentativa (1s, 2s, 4s)


def _loads_maybe(text: str) -> Any:
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def _exigir(params: dict[str, Any], *obrigatorios: str) -> dict[str, str] | None:
    """Devolve o erro se faltar algum campo, ou None se estiver tudo lá.

    Antes cada método repetia um `if not params.get(x): return {"error": ...}`
    por campo — 31 no total. Além do volume, isso revelava UM campo faltante por
    chamada: o cliente corrigia, chamava de novo e descobria o próximo. Aqui
    todos vêm juntos.
    """
    faltando = [c for c in obrigatorios if not params.get(c)]
    if not faltando:
        return None
    return {"error": f"Campo(s) obrigatório(s) ausente(s): {', '.join(faltando)}"}


def _chamada_sicoob(operacao: str) -> Any:
    """Padroniza o tratamento de erro de uma chamada à API do Sicoob.

    Eram 13 blocos try/except copiados, e a cópia escondia um bug: baixa_boleto,
    listar_boleto e consultar_webhook devolviam "Falha ao consultar Boleto
    Cobranca" — mensagem herdada de consultar_boleto. Quem falhava ao dar baixa
    lia que a *consulta* falhou.

    Com a mensagem derivada de `operacao`, herdar o texto de outro método deixa
    de ser possível.
    """
    def decorator(fn: Any) -> Any:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return fn(*args, **kwargs)
            except httpx.HTTPStatusError as exc:
                logger.warning("Sicoob API error ao %s: %s", operacao, exc)
                parsed = _loads_maybe(exc.response.text)
                if not parsed:
                    return {"status_code": exc.response.status_code, "body": exc.response.text}
                return parsed
            except Exception as exc:  # noqa: BLE001
                logger.warning("Falha ao %s: %s", operacao, exc)
                return {"error": f"Falha ao {operacao}: {exc}"}
        return wrapper
    return decorator


class BankingSicoobV3:
    def __init__(self, config: dict[str, Any]) -> None:
        self._config = dict(config)
        self._sandbox = bool(self._config.get("sandbox"))
        self._sandbox_base = str(self._config.get("sandbox_base_url", ""))
        self._url = self._sandbox_base if self._sandbox else str(self._config.get("prod_base_url", ""))
        if self._sandbox:
            self._token = str(self._config.get("sandbox_token", ""))
            self._client_id = str(self._config.get("sandbox_client_id", ""))
        else:
            tokens = TokenV3(self._config)
            ret = tokens.get_token()
            if not isinstance(ret, dict) or "access_token" not in ret:
                raise ValueError(f"Token Sicoob inválido: {ret!r}")
            self._token = ret["access_token"]
            self._client_id = str(self._config["client_id"])

        ssl_context: ssl.SSLContext | None = self._config.get("ssl_context")
        self._client = httpx.Client(
            base_url=self._url,
            timeout=60.0,
            verify=ssl_context if ssl_context is not None else True,
        )

    def close(self) -> None:
        self._client.close()

    def _path(self, suffix: str) -> str:
        return f"{self._sandbox_base if self._sandbox else ''}{suffix}"

    def _headers_json(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "client_id": self._client_id,
            "Authorization": f"Bearer {self._token}",
        }

    def gerar_token(self) -> str:
        return self._token

    def set_token(self, token: str) -> None:
        self._token = token

    def get_token(self) -> str:
        return self._token

    def _execute(self, fn: Any, *args: Any, **kwargs: Any) -> httpx.Response:
        """Executa fn(*args, **kwargs) com retry em backoff exponencial para HTTP 429."""
        for attempt in range(_MAX_RETRIES + 1):
            r: httpx.Response = fn(*args, **kwargs)
            if r.status_code != 429 or attempt >= _MAX_RETRIES:
                r.raise_for_status()
                return r
            delay = _RETRY_BASE_DELAY * (2 ** attempt)
            logger.warning(
                "Rate limit 429 da API Sicoob — aguardando %.1fs antes de tentar novamente (tentativa %d/%d)",
                delay,
                attempt + 1,
                _MAX_RETRIES,
            )
            time.sleep(delay)
        raise AssertionError("unreachable")

    @_chamada_sicoob("registrar o boleto")
    def registrar_boleto(self, fields: dict[str, Any]) -> Any:
        path = self._path("/cobranca-bancaria/v3/boletos")
        r = self._execute(
            self._client.post,
            path,
            headers=self._headers_json(),
            content=json.dumps(fields),
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("emitir a segunda via")
    def segunda_via_boleto(self, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        if erro := _exigir(params, "numeroCliente", "codigoModalidade"):
            return erro

        identificadores = ("nossoNumero", "linhaDigitavel", "codigoBarras")
        if not any(params.get(k) for k in identificadores):
            return {"error": "Informe pelo menos um: nossoNumero, linhaDigitavel ou codigoBarras"}

        path = self._path("/cobranca-bancaria/v3/boletos/segunda-via")
        query: dict[str, Any] = {
            "numeroCliente": int(params["numeroCliente"]),
            "codigoModalidade": int(params["codigoModalidade"]),
            "gerarPdf": params.get("gerarPdf", True),
        }
        if params.get("nossoNumero"):
            query["nossoNumero"] = int(params["nossoNumero"])
        if params.get("linhaDigitavel"):
            query["linhaDigitavel"] = params["linhaDigitavel"]
        if params.get("codigoBarras"):
            query["codigoBarras"] = params["codigoBarras"]
        r = self._execute(
            self._client.get,
            path,
            headers={**self._headers_json(), "Accept": "application/json"},
            params=query,
        )
        response_body = _loads_maybe(r.text)
        return {"status": r.status_code, "response": response_body}
    @_chamada_sicoob("consultar o boleto")
    def consultar_boleto(self, params: dict[str, Any]) -> Any:
        if erro := _exigir(params, "numeroCliente", "codigoModalidade"):
            return erro
        identificadores = ("nossoNumero", "linhaDigitavel", "codigoBarras")
        if not any(params.get(k) for k in identificadores):
            return {"error": "Informe pelo menos um: nossoNumero, linhaDigitavel ou codigoBarras"}
        query: dict[str, Any] = {
            "numeroCliente": int(params["numeroCliente"]),
            "codigoModalidade": int(params["codigoModalidade"]),
        }
        if params.get("nossoNumero"):
            query["nossoNumero"] = int(params["nossoNumero"])
        if params.get("linhaDigitavel"):
            query["linhaDigitavel"] = params["linhaDigitavel"]
        if params.get("codigoBarras"):
            query["codigoBarras"] = params["codigoBarras"]
        if params.get("numeroContratoCobranca"):
            query["numeroContratoCobranca"] = int(params["numeroContratoCobranca"])
        r = self._execute(
            self._client.get,
            self._path("/cobranca-bancaria/v3/boletos"),
            headers={**self._headers_json(), "Accept": "application/json"},
            params=query,
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("dar baixa no boleto")
    def baixa_boleto(self, params: dict[str, Any]) -> Any:
        if erro := _exigir(params, "nossoNumero", "numeroCliente"):
            return erro
        boleto = int(params["nossoNumero"])
        numero_cliente = int(params["numeroCliente"])
        path = self._path(f"/cobranca-bancaria/v3/boletos/{boleto}/baixar")
        r = self._execute(
            self._client.post,
            path,
            headers={**self._headers_json(), "Accept": "application/json"},
            content=json.dumps({"numeroCliente": numero_cliente, "codigoModalidade": 1}),
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("listar os boletos do pagador")
    def listar_boleto(self, params: dict[str, Any]) -> Any:
        if erro := _exigir(params, "numeroCliente", "numeroCpfCnpj", "dataInicio", "dataFim"):
            return erro
        cpf = str(params["numeroCpfCnpj"])
        path = self._path(f"/cobranca-bancaria/v3/pagadores/{cpf}/boletos")
        query: dict[str, Any] = {
            "numeroCliente": int(params["numeroCliente"]),
            "dataInicio": params["dataInicio"],
            "dataFim": params["dataFim"],
            "numeroCpfCnpj": cpf,
        }
        if params.get("codigoSituacao") is not None:
            query["codigoSituacao"] = int(params["codigoSituacao"])
        r = self._execute(
            self._client.get,
            path,
            headers={**self._headers_json(), "Accept": "application/json"},
            params=query,
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("consultar as faixas de nosso número")
    def consultar_faixas_nosso_numero(self, params: dict[str, Any]) -> Any:
        if erro := _exigir(params, "numeroCliente", "codigoModalidade", "quantidade"):
            return erro
        query: dict[str, Any] = {
            "numeroCliente": int(params["numeroCliente"]),
            "codigoModalidade": int(params["codigoModalidade"]),
            "quantidade": int(params["quantidade"]),
        }
        if params.get("numeroContratoCobranca"):
            query["numeroContratoCobranca"] = int(params["numeroContratoCobranca"])
        r = self._execute(
            self._client.get,
            self._path("/cobranca-bancaria/v3/boletos/faixas-nosso-numero-disponiveis"),
            headers={**self._headers_json(), "Accept": "application/json"},
            params=query,
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("alterar os dados do boleto")
    def alterar_dados_boleto(self, fields: dict[str, Any], nosso_numero: str | int) -> Any:
        path = self._path(f"/cobranca-bancaria/v3/boletos/{nosso_numero}")
        r = self._execute(
            self._client.patch,
            path,
            headers=self._headers_json(),
            content=json.dumps(fields),
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("cadastrar o webhook")
    def cadastrar_webhook(self, fields: dict[str, Any]) -> Any:
        if erro := _exigir(fields, "url", "codigoTipoMovimento", "codigoPeriodoMovimento"):
            return erro
        path = self._path("/cobranca-bancaria/v3/webhooks")
        r = self._execute(
            self._client.post,
            path,
            headers={**self._headers_json(), "Accept": "application/json"},
            content=json.dumps(fields),
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("consultar o webhook")
    def consultar_webhook(self, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        query: dict[str, Any] = {"codigoTipoMovimento": 7}
        if params.get("idWebhook"):
            query["idWebhook"] = params["idWebhook"]
        path = self._path("/cobranca-bancaria/v3/webhooks")
        r = self._execute(
            self._client.get,
            path,
            headers={**self._headers_json(), "Accept": "application/json"},
            params=query,
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("alterar o webhook")
    def alterar_webhook(self, fields: dict[str, Any], id_webhook: str | int) -> Any:
        path = self._path(f"/cobranca-bancaria/v3/webhooks/{id_webhook}")
        r = self._execute(
            self._client.patch,
            path,
            headers={**self._headers_json(), "Accept": "application/json"},
            content=json.dumps(fields),
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("consultar as solicitações do webhook")
    def consultar_solicitacoes_webhook(self, id_webhook: str | int, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        query: dict[str, Any] = {}
        if params.get("dataSolicitacao"):
            query["dataSolicitacao"] = params["dataSolicitacao"]
        if params.get("pagina"):
            query["pagina"] = int(params["pagina"])
        if params.get("codigoSolicitacaoSituacao"):
            query["codigoSolicitacaoSituacao"] = int(params["codigoSolicitacaoSituacao"])
        path = self._path(f"/cobranca-bancaria/v3/webhooks/{id_webhook}/solicitacoes")
        r = self._execute(
            self._client.get,
            path,
            headers={**self._headers_json(), "Accept": "application/json"},
            params=query,
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("reativar o webhook")
    def reativar_webhook(self, id_webhook: str | int) -> Any:
        path = self._path(f"/cobranca-bancaria/v3/webhooks/{id_webhook}/reativar")
        r = self._execute(
            self._client.patch,
            path,
            headers={**self._headers_json(), "Accept": "application/json"},
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
    @_chamada_sicoob("deletar o webhook")
    def deletar_webhook(self, id_webhook: str | int) -> Any:
        path = self._path(f"/cobranca-bancaria/v3/webhooks/{id_webhook}")
        r = self._execute(
            self._client.delete,
            path,
            headers={**self._headers_json(), "Accept": "application/json"},
        )
        result = _loads_maybe(r.text)
        return {"status": r.status_code, "response": result}
