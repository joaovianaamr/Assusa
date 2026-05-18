import ssl
import subprocess

import httpx
import pytest
import respx

from sicoob_service.certificate_tools import ssl_context_from_pem
from sicoob_service.token_v3 import TokenV3


def _openssl_self_signed(tmp_path) -> ssl.SSLContext:
    cert = tmp_path / "cert.pem"
    key = tmp_path / "key.pem"
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-keyout",
            str(key),
            "-out",
            str(cert),
            "-days",
            "1",
            "-nodes",
            "-subj",
            "/CN=test-sicoob-client",
        ],
        check=True,
        capture_output=True,
        timeout=30,
    )
    return ssl_context_from_pem(cert.read_bytes(), key.read_bytes())


@pytest.fixture
def mock_auth(respx_mock: respx.MockRouter) -> respx.MockRouter:
    respx_mock.post(
        "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token"
    ).mock(
        return_value=httpx.Response(
            200,
            json={"access_token": "tok-test", "token_type": "Bearer", "expires_in": 300},
        )
    )
    return respx_mock


@pytest.mark.skipif(
    subprocess.run(["which", "openssl"], capture_output=True).returncode != 0,
    reason="openssl não disponível",
)
def test_token_v3_client_credentials(mock_auth: respx.MockRouter, tmp_path) -> None:
    ctx = _openssl_self_signed(tmp_path)
    cfg = {
        "client_id": "cid",
        "ssl_context": ctx,
        "api": "boleto",
    }
    t = TokenV3(cfg)
    out = t.get_token()
    assert out.get("access_token") == "tok-test"
    assert mock_auth.calls.call_count == 1
