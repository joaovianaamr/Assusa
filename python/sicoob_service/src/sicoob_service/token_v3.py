"""Equivalente a TokenV3.php — OAuth2 client_credentials (realm cooperado)."""

from __future__ import annotations

import json
from typing import Any

import httpx

AUTH_BASE = "https://auth.sicoob.com.br"
TOKEN_PATH = "/auth/realms/cooperado/protocol/openid-connect/token"


def _scope_for_api(api: str | None) -> str:
    if api == "pix":
        return (
            "cob.write cob.read cobv.write cobv.read lotecobv.write lotecobv.read "
            "pix.write pix.read webhook.read webhook.write payloadlocation.write payloadlocation.read"
        )
    # MVP boleto; default alinhado ao ramo `boleto` do PHP
    return (
        "boletos_inclusao boletos_consulta boletos_alteracao webhooks_alteracao "
        "webhooks_consulta webhooks_inclusao"
    )


class TokenV3:
    def __init__(self, config: dict[str, Any]) -> None:
        self._config = config
        self._options_request = {
            "headers": {"Accept": "application/x-www-form-urlencoded"},
            "cert": config["certificate"],
            "ssl_key": config["certificateKey"],
        }

    def get_token(self) -> dict[str, Any] | Any:
        data = {
            "grant_type": "client_credentials",
            "client_id": self._config["client_id"],
            "scope": _scope_for_api(self._config.get("api")),
        }
        cert = (self._config["certificate"], self._config["certificateKey"])
        try:
            with httpx.Client(
                base_url=AUTH_BASE,
                timeout=60.0,
                verify=True,
                cert=cert,
            ) as client:
                r = client.post(TOKEN_PATH, data=data)
                r.raise_for_status()
                return dict(r.json())
        except httpx.HTTPStatusError as exc:
            body = exc.response.text
            try:
                parsed = json.loads(body) if body else None
            except json.JSONDecodeError:
                parsed = None
            if not parsed:
                return {"status_code": exc.response.status_code, "body": body}
            return parsed
        except Exception as exc:  # noqa: BLE001
            return {"error": str(exc)}
