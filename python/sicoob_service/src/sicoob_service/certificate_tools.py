"""Equivalente a CertificateTools.php (api-sicoob): PKCS#12 → ficheiros PEM temporários."""

from __future__ import annotations

import tempfile
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
from cryptography.hazmat.primitives.serialization import pkcs12

from sicoob_service.exceptions import SicoobCertificateError


class CertificateTools:
    """Espelha a classe PHP CertificateTools (geração de PEMs temporários)."""

    def __init__(self, client_id: str, certificate_content: bytes, certificate_password: str) -> None:
        self.client_id = client_id
        self._certifcate_files = self.generate_pem_files(client_id, certificate_content, certificate_password)

    def generate_pem_files(
        self,
        client_id: str,
        certificate_content: bytes,
        certificate_password: str,
    ) -> dict[str, str]:
        password_bytes = certificate_password.encode("utf-8") if certificate_password else None
        try:
            private_key, certificate, _extra_certs = pkcs12.load_key_and_certificates(
                certificate_content,
                password_bytes,
            )
        except Exception as exc:  # noqa: BLE001 — paridade com openssl_pkcs12_read falha genérica
            raise SicoobCertificateError(f"Error: {exc}") from exc

        if private_key is None or certificate is None:
            raise SicoobCertificateError("Error: PKCS#12 sem chave ou certificado")

        cert_pem = certificate.public_bytes(Encoding.PEM).decode("utf-8")
        key_pem = private_key.private_bytes(
            Encoding.PEM,
            PrivateFormat.PKCS8,
            NoEncryption(),
        ).decode("utf-8")

        tmp = Path(tempfile.gettempdir())
        cert_path = self._write_temp_pem(tmp / f"{client_id}.pem", cert_pem)
        key_path = self._write_temp_pem(tmp / f"{client_id}-private-key.pem", key_pem)
        return {"certificate": cert_path, "certificateKey": key_path}

    @staticmethod
    def _write_temp_pem(path: Path, content: str) -> str:
        path.write_text(content, encoding="utf-8")
        return str(path)

    def get_certificate_file_path(self) -> str:
        return self._certifcate_files["certificate"]

    def get_private_key_file_path(self) -> str:
        return self._certifcate_files["certificateKey"]
