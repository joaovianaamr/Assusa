"""
Port parcial de BankingSicoobV3.php (api-sicoob): cobrança v3 + webhooks cobrança.
PIX e movimentação v2 não estão no MVP.
"""

from __future__ import annotations

import json
import logging
import ssl
from typing import Any

import httpx

from sicoob_service.token_v3 import TokenV3

logger = logging.getLogger(__name__)


def _loads_maybe(text: str) -> Any:
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


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

    def registrar_boleto(self, fields: dict[str, Any]) -> Any:
        path = self._path("/cobranca-bancaria/v3/boletos")
        try:
            r = self._client.post(
                path,
                headers=self._headers_json(),
                content=json.dumps(fields),
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": str(exc)}

    def segunda_via_boleto(self, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        if not params.get("numeroCliente"):
            return {"error": "numeroCliente é obrigatório"}
        if not params.get("codigoModalidade"):
            return {"error": "codigoModalidade é obrigatório"}

        identificadores = ("nossoNumero", "linhaDigitavel", "codigoBarras")
        if not any(params.get(k) for k in identificadores):
            return {"error": "Informe pelo menos um: nossoNumero, linhaDigitavel ou codigoBarras"}

        path = self._path("/cobranca-bancaria/v3/boletos/segunda-via")
        query = {
            "numeroCliente": int(params["numeroCliente"]),
            "codigoModalidade": 1,
            "nossoNumero": params.get("nossoNumero"),
            "linhaDigitavel": params.get("linhaDigitavel"),
            "codigoBarras": params.get("codigoBarras"),
            "gerarPdf": "true",
        }
        try:
            r = self._client.get(
                path,
                headers={
                    **self._headers_json(),
                    "Accept": "application/json",
                },
                params=query,
            )
            r.raise_for_status()
            response_body = _loads_maybe(r.text)
            return {"status": r.status_code, "response": response_body}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": str(exc)}

    def consultar_boleto(self, params: dict[str, Any]) -> Any:
        if not params.get("numeroCliente"):
            return {"error": "numeroCliente é obrigatório"}
        if not params.get("numeroContratoCobranca"):
            return {"error": "numeroContratoCobranca é obrigatório"}
        try:
            r = self._client.get(
                self._path("/cobranca-bancaria/v3/boletos"),
                headers={**self._headers_json(), "Accept": "application/json"},
                params={
                    "numeroCliente": int(params["numeroCliente"]),
                    "codigoModalidade": 1,
                    "linhaDigitavel": params.get("linhaDigitavel"),
                    "codigoBarras": params.get("codigoBarras"),
                    "numeroContratoCobranca": int(params["numeroContratoCobranca"]),
                },
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": f"Falha ao consultar Boleto Cobranca: {exc}"}

    def baixa_boleto(self, params: dict[str, Any]) -> Any:
        if not params.get("nossoNumero"):
            return {"error": "nossoNumero é obrigatório"}
        if not params.get("numeroCliente"):
            return {"error": "numeroCliente é obrigatório"}
        boleto = int(params["nossoNumero"])
        numero_cliente = int(params["numeroCliente"])
        path = self._path(f"/cobranca-bancaria/v3/boletos/{boleto}/baixar")
        try:
            r = self._client.post(
                path,
                headers={**self._headers_json(), "Accept": "application/json"},
                content=json.dumps({"numeroCliente": numero_cliente, "codigoModalidade": 1}),
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": f"Falha ao consultar Boleto Cobranca: {exc}"}

    def listar_boleto(self, params: dict[str, Any]) -> Any:
        if not params.get("numeroCliente"):
            return {"error": "numeroCliente é obrigatório"}
        if not params.get("numeroCpfCnpj"):
            return {"error": "numeroCpfCnpj é obrigatório"}
        if not params.get("dataInicio"):
            return {"error": "dataInicio é obrigatório"}
        if not params.get("dataFim"):
            return {"error": "dataFim é obrigatório"}
        cpf = params["numeroCpfCnpj"]
        path = self._path(f"/cobranca-bancaria/v3/pagadores/{cpf}/boletos")
        try:
            r = self._client.get(
                path,
                headers={**self._headers_json(), "Accept": "application/json"},
                params={
                    "numeroCliente": int(params["numeroCliente"]),
                    "codigoSituacao": 1,
                    "dataInicio": params["dataInicio"],
                    "dataFim": params["dataFim"],
                    "numeroCpfCnpj": int(params["numeroCpfCnpj"]),
                },
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": f"Falha ao consultar Boleto Cobranca: {exc}"}

    def alterar_dados_boleto(self, fields: dict[str, Any], nosso_numero: str | int) -> Any:
        path = self._path(f"/cobranca-bancaria/v3/boletos/{nosso_numero}")
        try:
            r = self._client.patch(
                path,
                headers=self._headers_json(),
                content=json.dumps(fields),
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": str(exc)}

    def cadastrar_webhook(self, fields: dict[str, Any]) -> Any:
        path = self._path("/cobranca-bancaria/v3/webhooks")
        try:
            r = self._client.post(
                path,
                headers={**self._headers_json(), "Accept": "application/json"},
                content=json.dumps(fields),
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": str(exc)}

    def consultar_webhook(self, params: dict[str, Any]) -> Any:
        path = self._path("/cobranca-bancaria/v3/webhooks")
        try:
            r = self._client.get(
                path,
                headers={**self._headers_json(), "Accept": "application/json"},
                params={"idWebhook": params["idWebhook"], "codigoTipoMovimento": 7},
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": f"Falha ao consultar Boleto Cobranca: {exc}"}

    def alterar_webhook(self, fields: dict[str, Any], id_webhook: str | int) -> Any:
        path = self._path(f"/cobranca-bancaria/v3/webhooks/{id_webhook}")
        try:
            r = self._client.patch(
                path,
                headers={**self._headers_json(), "Accept": "application/json"},
                content=json.dumps(fields),
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": str(exc)}

    def deletar_webhook(self, id_webhook: str | int) -> Any:
        path = self._path(f"/cobranca-bancaria/v3/webhooks/{id_webhook}")
        try:
            r = self._client.delete(
                path,
                headers={**self._headers_json(), "Accept": "application/json"},
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            logger.warning("Sicoob API error: %s", exc)
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sicoob API error: %s", exc)
            return {"error": str(exc)}
