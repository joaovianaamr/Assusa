"""Resolve certificados PEM e constrói o cliente BankingSicoobV3 a partir de Settings."""

from __future__ import annotations

from pathlib import Path

from sicoob_service.banking_v3 import BankingSicoobV3
from sicoob_service.certificate_tools import CertificateTools
from sicoob_service.exceptions import SicoobConfigError
from sicoob_service.settings import Settings


def resolve_cert_paths(settings: Settings) -> tuple[str, str]:
    if settings.sicoob_p12_path:
        p12 = Path(settings.sicoob_p12_path)
        if not p12.is_file():
            raise SicoobConfigError(f"SICOOB_P12_PATH não é ficheiro válido: {p12}")
        cid = settings.sicoob_client_id or "sicoob-client"
        tools = CertificateTools(
            cid,
            p12.read_bytes(),
            settings.sicoob_p12_password,
        )
        return tools.get_certificate_file_path(), tools.get_private_key_file_path()

    if settings.sicoob_cert_path and settings.sicoob_key_path:
        c, k = Path(settings.sicoob_cert_path), Path(settings.sicoob_key_path)
        if not c.is_file() or not k.is_file():
            raise SicoobConfigError("SICOOB_CERT_PATH e SICOOB_KEY_PATH devem apontar para ficheiros existentes")
        return str(c), str(k)

    raise SicoobConfigError(
        "Defina SICOOB_CERT_PATH + SICOOB_KEY_PATH ou então SICOOB_P12_PATH + SICOOB_P12_PASSWORD"
    )


def build_sicoob_config(settings: Settings) -> dict:
    cert, key = resolve_cert_paths(settings)
    return {
        "sandbox": settings.sicoob_sandbox,
        "certificate": cert,
        "certificateKey": key,
        "client_id": settings.sicoob_client_id,
        "api": "boleto",
    }


def create_banking_client(settings: Settings) -> BankingSicoobV3:
    if not settings.sicoob_sandbox and not settings.sicoob_client_id:
        raise SicoobConfigError("SICOOB_CLIENT_ID é obrigatório quando SICOOB_SANDBOX=false")
    return BankingSicoobV3(build_sicoob_config(settings))
