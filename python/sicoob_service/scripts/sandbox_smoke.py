"""Smoke test manual contra a sandbox do Sicoob — rodar direto: python tests/sandbox_smoke.py"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta

from sicoob_service.banking_v3 import BankingSicoobV3

SANDBOX_CONFIG = {
    "sandbox": True,
    "sandbox_base_url": "https://sandbox.sicoob.com.br/sicoob/sandbox",
    "sandbox_token": "1301865f-c6bc-38f3-9f49-666dbcfc59c3",
    "sandbox_client_id": "9b5e603e428cc477a2841e2683c92d21",
    "ssl_context": None,
}

NUMERO_CLIENTE = 1106591
HOJE = date.today().strftime("%Y-%m-%d")
VENCIMENTO = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")
SEU_NUMERO = str(random.randint(1000, 9999))
CPF_TESTE = "98765432185"

BOLETO_PAYLOAD = {
    "numeroCliente": NUMERO_CLIENTE,
    "codigoModalidade": 1,
    "numeroContaCorrente": 0,
    "codigoEspecieDocumento": "DM",
    "dataEmissao": HOJE,
    "seuNumero": SEU_NUMERO,
    "identificacaoEmissaoBoleto": 1,
    "identificacaoDistribuicaoBoleto": 1,
    "valor": 150.00,
    "dataVencimento": VENCIMENTO,
    "tipoDesconto": 0,
    "tipoMulta": 0,
    "tipoJurosMora": 3,
    "numeroParcela": 1,
    "pagador": {
        "numeroCpfCnpj": CPF_TESTE,
        "nome": "Pagador Teste Sandbox",
        "endereco": "Rua Teste Sandbox, 123",
        "bairro": "Centro",
        "cidade": "Belo Horizonte",
        "cep": "30130010",
        "uf": "MG",
    },
    "gerarPdf": False,
}


def _pp(label: str, data: object) -> None:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def _ok(result: dict) -> bool:
    return isinstance(result, dict) and result.get("status") in (200, 201)


def _nosso_numero(result: dict) -> int | None:
    resp = result.get("response") or result
    if isinstance(resp, dict):
        for key in ("nossoNumero", "resultado"):
            v = resp.get(key)
            if isinstance(v, int) and v > 0:
                return v
            if isinstance(v, dict):
                nn = v.get("nossoNumero")
                if nn and int(nn) > 0:
                    return int(nn)
    return None


def main() -> None:
    print(f"[sandbox] seuNumero={SEU_NUMERO}  vencimento={VENCIMENTO}")
    banking = BankingSicoobV3(SANDBOX_CONFIG)

    # ── 1. Registrar boleto ───────────────────────────────────────
    r1 = banking.registrar_boleto(BOLETO_PAYLOAD)
    _pp("POST registrar_boleto", r1)
    nosso_numero = _nosso_numero(r1) if _ok(r1) else None

    # ── 2. Segunda via ────────────────────────────────────────────
    r2 = banking.segunda_via_boleto({
        "numeroCliente": NUMERO_CLIENTE,
        "codigoModalidade": 1,
        "nossoNumero": nosso_numero or 1,
        "gerarPdf": True,
    })
    _pp("GET segunda_via_boleto", r2)

    # ── 3. Consultar boleto ───────────────────────────────────────
    r3 = banking.consultar_boleto({
        "numeroCliente": NUMERO_CLIENTE,
        "codigoModalidade": 1,
        "nossoNumero": nosso_numero or 1,
    })
    _pp("GET consultar_boleto", r3)

    # ── 4. Listar boletos por pagador ─────────────────────────────
    data_inicio = (date.today() - timedelta(days=30)).strftime("%Y-%m-%d")
    r4 = banking.listar_boleto({
        "numeroCliente": NUMERO_CLIENTE,
        "numeroCpfCnpj": CPF_TESTE,
        "dataInicio": data_inicio,
        "dataFim": HOJE,
        "codigoSituacao": 1,  # 1=Em Aberto, 2=Baixado, 3=Liquidado
    })
    _pp("GET listar_boleto (por pagador)", r4)

    # ── 5. Baixar boleto ──────────────────────────────────────────
    r5 = banking.baixa_boleto({
        "nossoNumero": nosso_numero or 1,
        "numeroCliente": NUMERO_CLIENTE,
    })
    _pp("POST baixa_boleto", r5)

    # ── 6. Alterar dados do boleto (apenas UM objeto por request) ────────────
    nova_data = (date.today() + timedelta(days=60)).strftime("%Y-%m-%d")
    r6 = banking.alterar_dados_boleto(
        {
            "numeroCliente": NUMERO_CLIENTE,
            "codigoModalidade": 1,
            "prorrogacaoVencimento": {"dataVencimento": nova_data},
        },
        nosso_numero or 1,
    )
    _pp("PATCH alterar_dados_boleto", r6)

    # ── 7. Consultar faixas de nosso numero disponiveis ───────────
    r7 = banking.consultar_faixas_nosso_numero({
        "numeroCliente": NUMERO_CLIENTE,
        "codigoModalidade": 1,
        "quantidade": 10,
    })
    _pp("GET consultar_faixas_nosso_numero", r7)

    # ── 8. Webhook: cadastrar ─────────────────────────────────────
    r8 = banking.cadastrar_webhook({
        "url": "https://example.com/webhook/boleto",
        "codigoTipoMovimento": 7,
        "codigoPeriodoMovimento": 1,
        "email": "dev@example.com",
    })
    _pp("POST cadastrar_webhook", r8)

    # ── 9. Webhook: consultar (todos) ─────────────────────────────
    r9 = banking.consultar_webhook()
    _pp("GET consultar_webhook (todos)", r9)

    # ── 10. Webhook: consultar por id ─────────────────────────────
    r10 = banking.consultar_webhook({"idWebhook": "1"})
    _pp("GET consultar_webhook (idWebhook=1)", r10)

    # ── 11. Webhook: alterar ─────────────────────────────────────
    r11 = banking.alterar_webhook({"url": "https://example.com/webhook/v2", "email": "teste@example.com"}, 1)
    _pp("PATCH alterar_webhook", r11)

    # ── 12. Webhook: consultar solicitacoes ───────────────────────
    r12 = banking.consultar_solicitacoes_webhook(1, {
        "dataSolicitacao": HOJE,
        "pagina": 1,
        "codigoSolicitacaoSituacao": 3,
    })
    _pp("GET consultar_solicitacoes_webhook", r12)

    # ── 13. Webhook: reativar ─────────────────────────────────────
    r13 = banking.reativar_webhook(1)
    _pp("PATCH reativar_webhook", r13)

    # ── 14. Webhook: deletar ──────────────────────────────────────
    r14 = banking.deletar_webhook(1)
    _pp("DELETE deletar_webhook", r14)

    banking.close()
    print("\n[done] smoke test concluido")


if __name__ == "__main__":
    main()
