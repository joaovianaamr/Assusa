"""Resolve certificados e constrói o cliente BankingSicoobV3 a partir de Settings."""

from __future__ import annotations

import ssl
from pathlib import Path

from sicoob_service.banking_v3 import BankingSicoobV3
from sicoob_service.certificate_tools import CertificateTools, ssl_context_from_pem
from sicoob_service.exceptions import SicoobConfigError
from sicoob_service.settings import Settings


def build_ssl_context(settings: Settings) -> ssl.SSLContext:
    if settings.sicoob_p12_path:
        p12 = Path(settings.sicoob_p12_path)
        if not p12.is_file():
            raise SicoobConfigError(f"SICOOB_P12_PATH não é ficheiro válido: {p12}")
        tools = CertificateTools(p12.read_bytes(), settings.sicoob_p12_password)
        return tools.get_ssl_context()

    if settings.sicoob_cert_path and settings.sicoob_key_path:
        c, k = Path(settings.sicoob_cert_path), Path(settings.sicoob_key_path)
        if not c.is_file() or not k.is_file():
            raise SicoobConfigError(
                "SICOOB_CERT_PATH e SICOOB_KEY_PATH devem apontar para ficheiros existentes"
            )
        return ssl_context_from_pem(c.read_bytes(), k.read_bytes())

    raise SicoobConfigError(
        "Defina SICOOB_CERT_PATH + SICOOB_KEY_PATH ou então SICOOB_P12_PATH + SICOOB_P12_PASSWORD"
    )


def _base_config(settings: Settings) -> dict:
    return {
        "sandbox_base_url": settings.sicoob_sandbox_base_url,
        "prod_base_url": settings.sicoob_prod_base_url,
        "sandbox_token": settings.sicoob_sandbox_token,
        "sandbox_client_id": settings.sicoob_sandbox_client_id,
        "client_id": settings.sicoob_client_id,
        "api": "boleto",
    }


def build_sicoob_config(settings: Settings) -> dict:
    if settings.sicoob_sandbox:
        return {**_base_config(settings), "sandbox": True, "ssl_context": None}
    return {**_base_config(settings), "sandbox": False, "ssl_context": build_ssl_context(settings)}


def create_banking_client(settings: Settings) -> BankingSicoobV3:
    if not settings.sicoob_sandbox and not settings.sicoob_client_id:
        raise SicoobConfigError("SICOOB_CLIENT_ID é obrigatório quando SICOOB_SANDBOX=false")
    return BankingSicoobV3(build_sicoob_config(settings))
