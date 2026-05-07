"""
Port parcial de BankingSicoobV3.php (api-sicoob): cobrança v3 + webhooks cobrança.
PIX e movimentação v2 não estão no MVP.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from sicoob_service.token_v3 import TokenV3

logger = logging.getLogger(__name__)

PROD_BASE = "https://api.sicoob.com.br"
SANDBOX_BASE = "https://sandbox.sicoob.com.br/sicoob/sandbox"
SANDBOX_TOKEN = "1301865f-c6bc-38f3-9f49-666dbcfc59c3"
SANDBOX_CLIENT_ID = "9b5e603e428cc477a2841e2683c92d21"


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
        self._url = SANDBOX_BASE if self._sandbox else PROD_BASE
        if self._sandbox:
            self._token = SANDBOX_TOKEN
            self._client_id = SANDBOX_CLIENT_ID
        else:
            tokens = TokenV3(self._config)
            ret = tokens.get_token()
            if not isinstance(ret, dict) or "access_token" not in ret:
                raise ValueError(f"Token Sicoob inválido: {ret!r}")
            self._token = ret["access_token"]
            self._client_id = str(self._config["client_id"])

        self._client = httpx.Client(
            base_url=self._url,
            timeout=60.0,
            verify=True,
            cert=self._cert(),
        )

    def close(self) -> None:
        self._client.close()

    def _cert(self) -> tuple[str, str]:
        return (str(self._config["certificate"]), str(self._config["certificateKey"]))

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
        url_prefix = SANDBOX_BASE if self._sandbox else ""
        path = f"{url_prefix}/cobranca-bancaria/v3/boletos" if url_prefix else "/cobranca-bancaria/v3/boletos"
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
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": str(exc)}

    def segunda_via_boleto(self, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        base_url = SANDBOX_BASE if self._sandbox else ""

        if not params.get("numeroCliente"):
            return {"error": "numeroCliente é obrigatório"}
        if not params.get("codigoModalidade"):
            return {"error": "codigoModalidade é obrigatório"}

        identificadores = ("nossoNumero", "linhaDigitavel", "codigoBarras")
        if not any(params.get(k) for k in identificadores):
            return {"error": "Informe pelo menos um: nossoNumero, linhaDigitavel ou codigoBarras"}

        path = f"{base_url}/cobranca-bancaria/v3/boletos/segunda-via"
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
            return {"status": r.status_code, "data": response_body}
        except httpx.HTTPStatusError as exc:
            logger.warning("Erro na requisição de segunda via: %s", exc)
            return {"error": "Erro na comunicação com a API Sicoob", "exception": str(exc)}
        except Exception as exc:  # noqa: BLE001
            logger.warning("Erro na requisição de segunda via: %s", exc)
            return {"error": "Erro na comunicação com a API Sicoob", "exception": str(exc)}

    def consultar_boleto(self, params: dict[str, Any]) -> Any:
        base = SANDBOX_BASE if self._sandbox else ""
        try:
            r = self._client.get(
                f"{base}/cobranca-bancaria/v3/boletos",
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
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": f"Falha ao consultar Boleto Cobranca: {exc}"}

    def baixa_boleto(self, params: dict[str, Any]) -> Any:
        base_url = self._url
        if self._sandbox:
            base_url = SANDBOX_BASE
        boleto = int(params["nossoNumero"])
        numero_cliente = int(params["numeroCliente"])
        path = f"{base_url}/cobranca-bancaria/v3/boletos/{boleto}/baixar"
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
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": f"Falha ao consultar Boleto Cobranca: {exc}"}

    def listar_boleto(self, params: dict[str, Any]) -> Any:
        cpf = params["numeroCpfCnpj"]
        base = SANDBOX_BASE if self._sandbox else ""
        path = f"{base}/cobranca-bancaria/v3/pagadores/{cpf}/boletos"
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
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": f"Falha ao consultar Boleto Cobranca: {exc}"}

    def alterar_dados_boleto(self, fields: dict[str, Any], nosso_numero: str | int) -> Any:
        url = SANDBOX_BASE if self._sandbox else ""
        # Paridade com PHP: "{$url}//cobranca-bancaria/..."
        path = f"{url}//cobranca-bancaria/v3/boletos/{nosso_numero}"
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
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": str(exc)}

    def cadastrar_webhook(self, fields: dict[str, Any]) -> Any:
        url_prefix = SANDBOX_BASE if self._sandbox else ""
        path = f"{url_prefix}/cobranca-bancaria/v3/webhooks" if url_prefix else "/cobranca-bancaria/v3/webhooks"
        try:
            r = self._client.post(
                path,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._token}",
                    "Accept": "application/json",
                    "client_id": self._client_id,
                },
                content=json.dumps(fields),
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": str(exc)}

    def consultar_webhook(self, params: dict[str, Any]) -> Any:
        path = f"/cobranca-bancaria/v3/webhooks?idWebhook={params['idWebhook']}&codigoTipoMovimento=7"
        try:
            r = self._client.get(
                path,
                headers={**self._headers_json(), "Accept": "application/json"},
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": f"Falha ao consultar Boleto Cobranca: {exc}"}

    def alterar_webhook(self, fields: dict[str, Any], id_webhook: str | int) -> Any:
        url = SANDBOX_BASE if self._sandbox else ""
        path = f"{url}/cobranca-bancaria/v3/webhooks/{id_webhook}"
        try:
            r = self._client.patch(
                path,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._token}",
                    "Accept": "application/json",
                    "client_id": self._client_id,
                },
                content=json.dumps(fields),
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": str(exc)}

    def delete_webhook(self, id_webhook: str | int) -> Any:
        url = SANDBOX_BASE if self._sandbox else ""
        path = f"{url}/cobranca-bancaria/v3/webhooks/{id_webhook}"
        try:
            r = self._client.delete(
                path,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._token}",
                    "Accept": "application/json",
                    "client_id": self._client_id,
                },
            )
            r.raise_for_status()
            result = _loads_maybe(r.text)
            return {"status": r.status_code, "response": result}
        except httpx.HTTPStatusError as exc:
            parsed = _loads_maybe(exc.response.text)
            if not parsed:
                return {"status_code": exc.response.status_code, "body": exc.response.text}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": str(exc)}
