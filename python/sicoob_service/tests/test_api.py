from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from sicoob_service.app import app, banking_dependency


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_internal_sem_chave(client: TestClient) -> None:
    r = client.post("/internal/boleto/segunda-via", json={})
    assert r.status_code == 401


def test_internal_chave_invalida(client: TestClient) -> None:
    r = client.post(
        "/internal/boleto/segunda-via",
        json={},
        headers={"X-Internal-Api-Key": "errado"},
    )
    assert r.status_code == 401


@pytest.fixture
def mock_banking() -> MagicMock:
    m = MagicMock()
    m.segunda_via_boleto.return_value = {
        "error": "Informe pelo menos um: nossoNumero, linhaDigitavel ou codigoBarras"
    }
    return m


def test_segunda_via_validacao(mock_banking: MagicMock) -> None:
    async def override_banking():
        yield mock_banking

    app.dependency_overrides[banking_dependency] = override_banking
    try:
        c = TestClient(app)
        r = c.post(
            "/internal/boleto/segunda-via",
            json={"numeroCliente": 1},
            headers={"X-Internal-Api-Key": "test-internal-key"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert (
            body["result"]["error"]
            == "Informe pelo menos um: nossoNumero, linhaDigitavel ou codigoBarras"
        )
    finally:
        app.dependency_overrides.pop(banking_dependency, None)
