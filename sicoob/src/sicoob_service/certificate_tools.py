"""Equivalente a CertificateTools.php (api-sicoob): PKCS#12 → ssl.SSLContext em memória."""

from __future__ import annotations

import os
import ssl

from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
from cryptography.hazmat.primitives.serialization import pkcs12

from sicoob_service.exceptions import SicoobCertificateError


class CertificateTools:
    """Carrega PKCS#12 e expõe ssl.SSLContext com mTLS — chave privada nunca toca o disco."""

    def __init__(self, certificate_content: bytes, certificate_password: str) -> None:
        self._ssl_context = self._build_ssl_context(certificate_content, certificate_password)

    def _build_ssl_context(self, certificate_content: bytes, certificate_password: str) -> ssl.SSLContext:
        password_bytes = certificate_password.encode("utf-8") if certificate_password else None
        try:
            private_key, certificate, _extra_certs = pkcs12.load_key_and_certificates(
                certificate_content,
                password_bytes,
            )
        except Exception as exc:  # noqa: BLE001
            raise SicoobCertificateError(f"Error: {exc}") from exc

        if private_key is None or certificate is None:
            raise SicoobCertificateError("Error: PKCS#12 sem chave ou certificado")

        cert_pem = certificate.public_bytes(Encoding.PEM)
        key_pem = private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())

        return ssl_context_from_pem(cert_pem, key_pem)

    def get_ssl_context(self) -> ssl.SSLContext:
        return self._ssl_context


def ssl_context_from_pem(cert_pem: bytes, key_pem: bytes) -> ssl.SSLContext:
    """Constrói SSLContext com mTLS usando memfd_create — chave nunca é gravada em disco."""
    fd_cert = os.memfd_create("sicoob-cert")
    fd_key = os.memfd_create("sicoob-key")
    try:
        os.write(fd_cert, cert_pem)
        os.lseek(fd_cert, 0, os.SEEK_SET)
        os.write(fd_key, key_pem)
        os.lseek(fd_key, 0, os.SEEK_SET)

        ctx = ssl.create_default_context()
        ctx.load_cert_chain(
            certfile=f"/proc/self/fd/{fd_cert}",
            keyfile=f"/proc/self/fd/{fd_key}",
        )
    finally:
        os.close(fd_cert)
        os.close(fd_key)

    return ctx
