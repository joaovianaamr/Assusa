"""Testes unitários dos endpoints FastAPI, validação banking_v3 e database."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from sicoob_service.app import app, banking_dependency
from sicoob_service.banking_v3 import BankingSicoobV3
from sicoob_service.settings import get_settings

INTERNAL_KEY = "test-internal-key"
HEADERS = {"X-Internal-Api-Key": INTERNAL_KEY}

_SANDBOX_CFG = {
    "sandbox": True,
    "sandbox_base_url": "https://sandbox.sicoob.com.br/sicoob/sandbox",
    "sandbox_token": "tok",
    "sandbox_client_id": "cid",
    "ssl_context": None,
}


# ── fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _set_internal_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_API_KEY", INTERNAL_KEY)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def banking() -> MagicMock:
    return MagicMock(spec=BankingSicoobV3)


@pytest.fixture
def client(banking: MagicMock) -> TestClient:
    async def _override():
        yield banking

    app.dependency_overrides[banking_dependency] = _override
    c = TestClient(app)
    yield c
    app.dependency_overrides.pop(banking_dependency, None)


@pytest.fixture
def bv3() -> BankingSicoobV3:
    """Instância real em modo sandbox — para testar validações sem HTTP."""
    b = BankingSicoobV3(_SANDBOX_CFG)
    yield b
    b.close()


# ── boleto/registrar ──────────────────────────────────────────────────────────

class TestBoletoRegistrar:
    def test_chama_metodo_correto(self, client: TestClient, banking: MagicMock) -> None:
        banking.registrar_boleto.return_value = {"status": 200, "response": {}}
        body = {"numeroCliente": 1, "valor": 100.0}
        r = client.post("/internal/boleto/registrar", json=body, headers=HEADERS)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        banking.registrar_boleto.assert_called_once_with(body)

    def test_sem_auth_retorna_401(self, client: TestClient) -> None:
        r = client.post("/internal/boleto/registrar", json={})
        assert r.status_code == 401


# ── boleto/consultar ──────────────────────────────────────────────────────────

class TestBoletoConsultar:
    def test_chama_com_nosso_numero(self, client: TestClient, banking: MagicMock) -> None:
        banking.consultar_boleto.return_value = {"status": 200, "response": {}}
        body = {"numeroCliente": 1, "codigoModalidade": 1, "nossoNumero": 123}
        r = client.post("/internal/boleto/consultar", json=body, headers=HEADERS)
        assert r.status_code == 200
        banking.consultar_boleto.assert_called_once_with(body)

    def test_chama_com_linha_digitavel(self, client: TestClient, banking: MagicMock) -> None:
        banking.consultar_boleto.return_value = {"status": 200, "response": {}}
        body = {"numeroCliente": 1, "codigoModalidade": 1, "linhaDigitavel": "123456"}
        r = client.post("/internal/boleto/consultar", json=body, headers=HEADERS)
        assert r.status_code == 200

    # validação no banking_v3
    def test_valida_sem_cliente(self, bv3: BankingSicoobV3) -> None:
        assert "error" in bv3.consultar_boleto({})

    def test_valida_sem_modalidade(self, bv3: BankingSicoobV3) -> None:
        assert "error" in bv3.consultar_boleto({"numeroCliente": 1})

    def test_valida_sem_identificador(self, bv3: BankingSicoobV3) -> None:
        r = bv3.consultar_boleto({"numeroCliente": 1, "codigoModalidade": 1})
        assert "error" in r
        assert "nossoNumero" in r["error"]


# ── boleto/segunda-via ───────────────────────────────────────────────────────

class TestBoletoSegundaVia:
    def test_chama_metodo_correto(self, client: TestClient, banking: MagicMock) -> None:
        banking.segunda_via_boleto.return_value = {"status": 200, "response": {"resultado": {}}}
        body = {"numeroCliente": 1964895, "codigoModalidade": 1, "linhaDigitavel": "123456"}
        r = client.post("/internal/boleto/segunda-via", json=body, headers=HEADERS)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        banking.segunda_via_boleto.assert_called_once_with(body)

    def test_sem_auth_retorna_401(self, client: TestClient) -> None:
        r = client.post("/internal/boleto/segunda-via", json={})
        assert r.status_code == 401

    def test_valida_sem_cliente(self, bv3: BankingSicoobV3) -> None:
        r = bv3.segunda_via_boleto({"codigoModalidade": 1, "linhaDigitavel": "123"})
        assert "error" in r

    def test_valida_sem_modalidade(self, bv3: BankingSicoobV3) -> None:
        r = bv3.segunda_via_boleto({"numeroCliente": 1, "linhaDigitavel": "123"})
        assert "error" in r

    def test_valida_sem_identificador(self, bv3: BankingSicoobV3) -> None:
        r = bv3.segunda_via_boleto({"numeroCliente": 1, "codigoModalidade": 1})
        assert "error" in r
        assert "nossoNumero" in r["error"]

    def test_nao_inclui_params_nulos_no_query(self, bv3: BankingSicoobV3) -> None:
        """nossoNumero=None e codigoBarras=None não devem entrar no query.

        httpx serializa None como string vazia, fazendo a API Sicoob ignorar
        a linhaDigitavel fornecida e retornar erro de validação.
        """
        captured: dict = {}

        def fake_get(path, **kwargs):
            captured["params"] = kwargs.get("params", {})
            resp = MagicMock()
            resp.status_code = 200
            resp.text = '{"resultado": {}}'
            resp.raise_for_status = MagicMock()
            return resp

        bv3._client.get = fake_get
        bv3.segunda_via_boleto({
            "numeroCliente": 1,
            "codigoModalidade": 1,
            "linhaDigitavel": "75691311750119648950200038610044714520000036907",
        })

        params = captured["params"]
        assert "linhaDigitavel" in params
        assert "nossoNumero" not in params
        assert "codigoBarras" not in params

    def test_nosso_numero_cast_para_int(self, bv3: BankingSicoobV3) -> None:
        captured: dict = {}

        def fake_get(path, **kwargs):
            captured["params"] = kwargs.get("params", {})
            resp = MagicMock()
            resp.status_code = 200
            resp.text = '{"resultado": {}}'
            resp.raise_for_status = MagicMock()
            return resp

        bv3._client.get = fake_get
        bv3.segunda_via_boleto({
            "numeroCliente": 1,
            "codigoModalidade": 1,
            "nossoNumero": "3861",
        })

        params = captured["params"]
        assert params["nossoNumero"] == 3861
        assert "linhaDigitavel" not in params
        assert "codigoBarras" not in params


# ── boleto/baixa ──────────────────────────────────────────────────────────────

class TestBoletoBaixa:
    def test_chama_metodo_correto(self, client: TestClient, banking: MagicMock) -> None:
        banking.baixa_boleto.return_value = {"status": 204, "response": None}
        body = {"nossoNumero": 123, "numeroCliente": 1}
        r = client.post("/internal/boleto/baixa", json=body, headers=HEADERS)
        assert r.status_code == 200
        banking.baixa_boleto.assert_called_once_with(body)

    def test_valida_sem_nosso_numero(self, bv3: BankingSicoobV3) -> None:
        assert "error" in bv3.baixa_boleto({"numeroCliente": 1})

    def test_valida_sem_cliente(self, bv3: BankingSicoobV3) -> None:
        assert "error" in bv3.baixa_boleto({"nossoNumero": 1})


# ── boleto/listar ─────────────────────────────────────────────────────────────

class TestBoletoListar:
    def test_chama_metodo_correto(self, client: TestClient, banking: MagicMock) -> None:
        banking.listar_boleto.return_value = {"status": 200, "response": {"resultado": []}}
        body = {
            "numeroCliente": 1,
            "numeroCpfCnpj": "98765432185",
            "dataInicio": "2026-01-01",
            "dataFim": "2026-05-22",
        }
        r = client.post("/internal/boleto/listar", json=body, headers=HEADERS)
        assert r.status_code == 200
        banking.listar_boleto.assert_called_once_with(body)

    def test_valida_sem_cpf(self, bv3: BankingSicoobV3) -> None:
        assert "error" in bv3.listar_boleto({"numeroCliente": 1})

    def test_valida_sem_data_inicio(self, bv3: BankingSicoobV3) -> None:
        r = bv3.listar_boleto({"numeroCliente": 1, "numeroCpfCnpj": "123", "dataFim": "2026-05-22"})
        assert "error" in r

    def test_valida_sem_data_fim(self, bv3: BankingSicoobV3) -> None:
        r = bv3.listar_boleto({"numeroCliente": 1, "numeroCpfCnpj": "123", "dataInicio": "2026-01-01"})
        assert "error" in r


# ── boleto/alterar ────────────────────────────────────────────────────────────

class TestBoletoAlterar:
    def test_passa_nosso_numero_como_path(self, client: TestClient, banking: MagicMock) -> None:
        banking.alterar_dados_boleto.return_value = {"status": 204, "response": None}
        body = {"numeroCliente": 1, "codigoModalidade": 1, "prorrogacaoVencimento": {"dataVencimento": "2026-07-01"}}
        r = client.patch("/internal/boleto/alterar/99999", json=body, headers=HEADERS)
        assert r.status_code == 200
        banking.alterar_dados_boleto.assert_called_once_with(body, "99999")


# ── boleto/faixas-nosso-numero ────────────────────────────────────────────────

class TestBoletoFaixasNossoNumero:
    def test_chama_com_params_obrigatorios(self, client: TestClient, banking: MagicMock) -> None:
        banking.consultar_faixas_nosso_numero.return_value = {"status": 200, "response": {}}
        r = client.get(
            "/internal/boleto/faixas-nosso-numero",
            params={"numeroCliente": 1, "codigoModalidade": 1, "quantidade": 10},
            headers=HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True
        banking.consultar_faixas_nosso_numero.assert_called_once_with(
            {"numeroCliente": 1, "codigoModalidade": 1, "quantidade": 10}
        )

    def test_inclui_contrato_quando_informado(self, client: TestClient, banking: MagicMock) -> None:
        banking.consultar_faixas_nosso_numero.return_value = {"status": 200, "response": {}}
        r = client.get(
            "/internal/boleto/faixas-nosso-numero",
            params={"numeroCliente": 1, "codigoModalidade": 1, "quantidade": 5, "numeroContratoCobranca": 7},
            headers=HEADERS,
        )
        assert r.status_code == 200
        banking.consultar_faixas_nosso_numero.assert_called_once_with(
            {"numeroCliente": 1, "codigoModalidade": 1, "quantidade": 5, "numeroContratoCobranca": 7}
        )

    def test_sem_quantidade_retorna_422(self, client: TestClient) -> None:
        r = client.get(
            "/internal/boleto/faixas-nosso-numero",
            params={"numeroCliente": 1, "codigoModalidade": 1},
            headers=HEADERS,
        )
        assert r.status_code == 422

    def test_valida_sem_quantidade(self, bv3: BankingSicoobV3) -> None:
        r = bv3.consultar_faixas_nosso_numero({"numeroCliente": 1, "codigoModalidade": 1})
        assert "error" in r
        assert "quantidade" in r["error"]


# ── webhook/cadastrar ─────────────────────────────────────────────────────────

class TestWebhookCadastrar:
    def test_chama_metodo_correto(self, client: TestClient, banking: MagicMock) -> None:
        banking.cadastrar_webhook.return_value = {"status": 201, "response": {"resultado": {"idWebhook": 1}}}
        body = {"url": "https://ex.com/wh", "codigoTipoMovimento": 7, "codigoPeriodoMovimento": 1}
        r = client.post("/internal/webhook/cadastrar", json=body, headers=HEADERS)
        assert r.status_code == 200
        banking.cadastrar_webhook.assert_called_once_with(body)

    def test_valida_sem_url(self, bv3: BankingSicoobV3) -> None:
        r = bv3.cadastrar_webhook({"codigoTipoMovimento": 7, "codigoPeriodoMovimento": 1})
        assert r == {"error": "url é obrigatório"}

    def test_valida_sem_tipo_movimento(self, bv3: BankingSicoobV3) -> None:
        r = bv3.cadastrar_webhook({"url": "https://ex.com", "codigoPeriodoMovimento": 1})
        assert r == {"error": "codigoTipoMovimento é obrigatório"}

    def test_valida_sem_periodo_movimento(self, bv3: BankingSicoobV3) -> None:
        r = bv3.cadastrar_webhook({"url": "https://ex.com", "codigoTipoMovimento": 7})
        assert r == {"error": "codigoPeriodoMovimento é obrigatório"}


# ── webhook/consultar ─────────────────────────────────────────────────────────

class TestWebhookConsultar:
    def test_sem_id_passa_dict_vazio(self, client: TestClient, banking: MagicMock) -> None:
        banking.consultar_webhook.return_value = {"status": 200, "response": {"resultado": []}}
        r = client.get("/internal/webhook/consultar", headers=HEADERS)
        assert r.status_code == 200
        banking.consultar_webhook.assert_called_once_with({})

    def test_com_id_passa_id_no_dict(self, client: TestClient, banking: MagicMock) -> None:
        banking.consultar_webhook.return_value = {"status": 200, "response": {"resultado": []}}
        r = client.get("/internal/webhook/consultar?idWebhook=42", headers=HEADERS)
        assert r.status_code == 200
        banking.consultar_webhook.assert_called_once_with({"idWebhook": "42"})


# ── webhook/alterar ───────────────────────────────────────────────────────────

class TestWebhookAlterar:
    def test_passa_id_e_body(self, client: TestClient, banking: MagicMock) -> None:
        banking.alterar_webhook.return_value = {"status": 204, "response": None}
        body = {"url": "https://new.ex.com/wh", "email": "a@b.com"}
        r = client.patch("/internal/webhook/7", json=body, headers=HEADERS)
        assert r.status_code == 200
        banking.alterar_webhook.assert_called_once_with(body, "7")


# ── webhook/reativar ──────────────────────────────────────────────────────────

class TestWebhookReativar:
    def test_chama_metodo_correto(self, client: TestClient, banking: MagicMock) -> None:
        banking.reativar_webhook.return_value = {"status": 204, "response": None}
        r = client.patch("/internal/webhook/7/reativar", headers=HEADERS)
        assert r.status_code == 200
        banking.reativar_webhook.assert_called_once_with("7")

    def test_nao_confunde_com_alterar(self, client: TestClient, banking: MagicMock) -> None:
        """PATCH /{id}/reativar deve ir para reativar, não alterar."""
        banking.reativar_webhook.return_value = {"status": 204, "response": None}
        client.patch("/internal/webhook/7/reativar", headers=HEADERS)
        banking.alterar_webhook.assert_not_called()
        banking.reativar_webhook.assert_called_once()


# ── webhook/solicitacoes ──────────────────────────────────────────────────────

class TestWebhookSolicitacoes:
    def test_chama_com_id_e_params(self, client: TestClient, banking: MagicMock) -> None:
        banking.consultar_solicitacoes_webhook.return_value = {"status": 200, "response": {}}
        r = client.get(
            "/internal/webhook/5/solicitacoes",
            params={"dataSolicitacao": "2026-05-22", "codigoSolicitacaoSituacao": 3},
            headers=HEADERS,
        )
        assert r.status_code == 200
        banking.consultar_solicitacoes_webhook.assert_called_once_with(
            "5", {"pagina": 1, "dataSolicitacao": "2026-05-22", "codigoSolicitacaoSituacao": 3}
        )

    def test_pagina_default_e_1(self, client: TestClient, banking: MagicMock) -> None:
        banking.consultar_solicitacoes_webhook.return_value = {"status": 200, "response": {}}
        client.get("/internal/webhook/5/solicitacoes", headers=HEADERS)
        _, params = banking.consultar_solicitacoes_webhook.call_args[0]
        assert params["pagina"] == 1


# ── webhook/deletar ───────────────────────────────────────────────────────────

class TestWebhookDeletar:
    def test_chama_metodo_correto(self, client: TestClient, banking: MagicMock) -> None:
        banking.deletar_webhook.return_value = {"status": 204, "response": None}
        r = client.delete("/internal/webhook/5", headers=HEADERS)
        assert r.status_code == 200
        banking.deletar_webhook.assert_called_once_with("5")


# ── /interno/interacao ────────────────────────────────────────────────────────

class TestInteracao:
    def test_registrar_chama_database(self, client: TestClient) -> None:
        with patch("sicoob_service.database.inserir") as mock_inserir:
            r = client.post(
                "/interno/interacao",
                json={"telefone": "5511999990000", "evento": "TESTE", "cpf": "12345678901"},
                headers=HEADERS,
            )
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        mock_inserir.assert_called_once_with(
            "5511999990000", "TESTE", "12345678901", None
        )

    def test_registrar_detalhes_opcionais(self, client: TestClient) -> None:
        with patch("sicoob_service.database.inserir") as mock_inserir:
            client.post(
                "/interno/interacao",
                json={"telefone": "5511999990000", "evento": "MENU_EXIBIDO"},
                headers=HEADERS,
            )
        mock_inserir.assert_called_once_with("5511999990000", "MENU_EXIBIDO", None, None)

    def test_listar_retorna_resultado(self, client: TestClient) -> None:
        rows = [{"telefone": "5511", "evento": "TESTE"}]
        with patch("sicoob_service.database.consultar", return_value=rows) as mock_consultar:
            r = client.get("/interno/interacoes", headers=HEADERS)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["result"] == rows
        mock_consultar.assert_called_once_with(None, None, None, None, None, 50)

    def test_listar_com_filtros(self, client: TestClient) -> None:
        with patch("sicoob_service.database.consultar", return_value=[]) as mock_consultar:
            client.get(
                "/interno/interacoes",
                params={"telefone": "5511", "evento": "TESTE", "limite": 10},
                headers=HEADERS,
            )
        mock_consultar.assert_called_once_with("5511", None, "TESTE", None, None, 10)

    def test_listar_limite_maximo_200(self, client: TestClient) -> None:
        with patch("sicoob_service.database.consultar", return_value=[]) as mock_consultar:
            client.get("/interno/interacoes", params={"limite": 500}, headers=HEADERS)
        _, _, _, _, _, limite = mock_consultar.call_args[0]
        assert limite == 200
