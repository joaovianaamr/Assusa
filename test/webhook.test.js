/**
 * Webhook HTTP tests. Conversation (Redis) loads only for POST payloads with
 * object === whatsapp_business_account; these cases stay minimal so Redis is not required.
 */
"use strict";

process.env.WHATSAPP_VERIFY_TOKEN = "test-verify-token";
process.env.ACCESS_TOKEN = "test-access-token";
process.env.APP_SECRET = "test-app-secret";
process.env.REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
process.env.REDIS_PORT = process.env.REDIS_PORT || "6379";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createApp } = require("../app");

test("GET /webhook valid mode and token returns 200 and exact challenge as text/plain", async () => {
  const app = createApp();
  const challenge = "1944739392";
  const res = await request(app)
    .get("/webhook")
    .query({
      "hub.mode": "subscribe",
      "hub.verify_token": "test-verify-token",
      "hub.challenge": challenge
    });

  assert.equal(res.status, 200);
  assert.ok(
    String(res.headers["content-type"] || "").includes("text/plain"),
    "content-type should be text/plain"
  );
  assert.equal(res.text, challenge);
});

test("GET /webhook invalid verify_token returns 403", async () => {
  const app = createApp();
  const res = await request(app)
    .get("/webhook")
    .query({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "1944739392"
    });

  assert.equal(res.status, 403);
});

test("GET /webhook invalid hub.mode returns 403", async () => {
  const app = createApp();
  const res = await request(app)
    .get("/webhook")
    .query({
      "hub.mode": "denied",
      "hub.verify_token": "test-verify-token",
      "hub.challenge": "1944739392"
    });

  assert.equal(res.status, 403);
});

test("POST /webhook returns 200 without X-Hub-Signature-256", async () => {
  const app = createApp();
  const res = await request(app).post("/webhook").send({});

  assert.equal(res.status, 200);
});

test("aguardando_cpf + button assusa-segunda-via reinicia o fluxo pedindo o CPF em duas mensagens", async (t) => {
  const Cache = require("../services/redis");
  const GraphApi = require("../services/graph-api");
  const interacao = require("../services/interacaoClient");
  const Conversation = require("../services/conversation");
  const constants = require("../services/constants");

  t.mock.method(Cache, "getEstado", async () => "aguardando_cpf");
  t.mock.method(Cache, "clearEstado", async () => {});
  t.mock.method(Cache, "setEstado", async () => {});
  t.mock.method(interacao, "registrar", () => {});
  const mockText = t.mock.method(GraphApi, "messageWithText", async () => {});

  await Conversation.handleMessage("phone-id-123", {
    from: "5531999999999",
    id: "wamid.test.001",
    timestamp: "1748000010",
    type: "interactive",
    interactive: {
      type: "button_reply",
      button_reply: { id: "assusa-segunda-via", title: "2ª via de conta" }
    }
  });

  assert.equal(mockText.mock.calls.length, 2, "deve enviar duas mensagens de CPF");
  assert.equal(
    mockText.mock.calls[0].arguments[3],
    constants.MSG_SOLICITAR_CPF_1,
    "1ª mensagem deve ser MSG_SOLICITAR_CPF_1"
  );
  assert.equal(
    mockText.mock.calls[1].arguments[3],
    constants.MSG_SOLICITAR_CPF_2,
    "2ª mensagem deve ser MSG_SOLICITAR_CPF_2"
  );
});

test("selecionar boleto entrega em partes e mantém a lista clicável (não limpa estado)", async (t) => {
  const Cache = require("../services/redis");
  const GraphApi = require("../services/graph-api");
  const interacao = require("../services/interacaoClient");
  const sicoobClient = require("../services/sicoobClient");
  const Conversation = require("../services/conversation");
  const constants = require("../services/constants");

  t.mock.method(Cache, "getEstado", async () => "aguardando_selecao_boleto");
  t.mock.method(Cache, "getBoletos", async () => [
    { linhaDigitavel: "L0", nossoNumero: 1, dataVencimentoOriginal: "2026-05-16", valorPagar: 76.97 },
    { linhaDigitavel: "L1", nossoNumero: 2, dataVencimentoOriginal: "2026-05-20", valorPagar: 379.89 },
  ]);
  const setEstado = t.mock.method(Cache, "setEstado", async () => {});
  const setBoletos = t.mock.method(Cache, "setBoletos", async () => {});
  const clearEstado = t.mock.method(Cache, "clearEstado", async () => {});
  const clearBoletos = t.mock.method(Cache, "clearBoletos", async () => {});
  t.mock.method(interacao, "registrar", () => {});
  t.mock.method(sicoobClient, "segundaViaBoleto", async () => ({
    body: {
      ok: true,
      result: {
        response: {
          resultado: {
            pdfBoleto: "JVBERi0=",
            qrCode: "PIX-COPIA-COLA",
            valor: 76.97,
            dataVencimento: "2026-06-17",
            linhaDigitavel: "L0",
          },
        },
      },
    },
  }));
  t.mock.method(GraphApi, "uploadMedia", async () => ({ id: "media-1" }));
  const mockDoc = t.mock.method(GraphApi, "messageWithDocument", async () => {});
  const mockText = t.mock.method(GraphApi, "messageWithText", async () => {});

  await Conversation.handleMessage("phone-id-123", {
    from: "5531999999999",
    id: "wamid.test.sel",
    timestamp: "1748000020",
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: "boleto-0", title: "1 - Conta 16/05" } },
  });

  assert.equal(mockDoc.mock.calls.length, 1, "deve enviar o PDF uma vez");
  // linha digitável (rótulo + número) + PIX (rótulo + código) = 4 mensagens
  assert.equal(mockText.mock.calls.length, 4, "deve enviar linha digitável e PIX em partes");
  const textos = mockText.mock.calls.map(c => c.arguments[3]);
  assert.ok(textos.includes(constants.MSG_LABEL_LINHA_DIGITAVEL));
  assert.ok(textos.includes("L0"));
  assert.ok(textos.includes(constants.MSG_LABEL_PIX));
  assert.ok(textos.includes("PIX-COPIA-COLA"));

  assert.equal(clearEstado.mock.calls.length, 0, "não deve limpar o estado após entregar");
  assert.equal(clearBoletos.mock.calls.length, 0, "não deve limpar os boletos após entregar");
  assert.ok(setEstado.mock.calls.length >= 1, "deve renovar o TTL do estado");
  assert.ok(setBoletos.mock.calls.length >= 1, "deve renovar o TTL dos boletos");
});

// ── caminhos novos: botões vs. lista, e os desfechos da consulta por CPF ──────

const CPF_VALIDO = "11144477735";
const constantsRef = require("../services/constants");

/** Monta o cenário de "cliente mandou o CPF" com os mocks mínimos. */
function cenarioCpf(t, { emAberto = [], historico = [], historicoFalha = false } = {}) {
  const Cache = require("../services/redis");
  const GraphApi = require("../services/graph-api");
  const interacao = require("../services/interacaoClient");
  const sicoobClient = require("../services/sicoobClient");

  t.mock.method(Cache, "getEstado", async () => "aguardando_cpf");
  t.mock.method(Cache, "setEstado", async () => {});
  t.mock.method(Cache, "setBoletos", async () => {});
  t.mock.method(Cache, "clearEstado", async () => {});
  t.mock.method(Cache, "clearBoletos", async () => {});
  t.mock.method(interacao, "registrar", () => {});

  const envelope = lista => ({
    status: 200,
    body: { ok: true, result: { response: { resultado: lista } } },
  });

  t.mock.method(sicoobClient, "listarBoletos", async ({ codigoSituacao }) => {
    // codigoSituacao === null é a consulta de histórico (sem filtro).
    if (codigoSituacao === null) {
      if (historicoFalha) {
        return { status: 503, body: { ok: false, result: { error: "janelas falharam" } } };
      }
      return envelope(historico);
    }
    return envelope(emAberto);
  });

  t.mock.method(sicoobClient, "segundaViaBoleto", async () => ({
    body: { ok: true, result: { response: { resultado: { valor: 100, dataVencimento: "2026-09-01" } } } },
  }));

  return {
    text: t.mock.method(GraphApi, "messageWithText", async () => {}),
    botoes: t.mock.method(GraphApi, "messageWithInteractiveReply", async () => {}),
    lista: t.mock.method(GraphApi, "messageWithInteractiveList", async () => {}),
  };
}

const enviarCpf = () =>
  require("../services/conversation").handleMessage("phone-id-123", {
    from: "5531999999999",
    id: "wamid.test.cpf",
    timestamp: "1748000030",
    type: "text",
    text: { body: CPF_VALIDO },
  });

const contas = n =>
  Array.from({ length: n }, (_, i) => ({
    linhaDigitavel: `L${i}`,
    nossoNumero: i,
    dataVencimento: `2026-0${i + 1}-10`,
    valor: 100 + i,
  }));

test("3 contas em aberto são entregues com botões", async (t) => {
  const m = cenarioCpf(t, { emAberto: contas(3) });
  await enviarCpf();

  assert.equal(m.botoes.mock.calls.length, 1, "deve usar mensagem de botões");
  assert.equal(m.lista.mock.calls.length, 0, "não deve usar lista");
  assert.equal(m.botoes.mock.calls[0].arguments[4].length, 3, "um botão por conta");
});

test("4 contas em aberto passam a usar a lista interativa", async (t) => {
  const m = cenarioCpf(t, { emAberto: contas(4) });
  await enviarCpf();

  assert.equal(m.lista.mock.calls.length, 1, "deve usar lista interativa");
  assert.equal(m.botoes.mock.calls.length, 0, "não deve usar botões");
  const [, , , , botao, secao, rows] = m.lista.mock.calls[0].arguments;
  assert.equal(rows.length, 4, "uma linha por conta");
  assert.equal(botao, constantsRef.MSG_LISTA_BOTAO);
  assert.equal(secao, constantsRef.MSG_LISTA_SECAO);
});

test("acima de 10 contas exibe as 10 mais antigas e avisa o total", async (t) => {
  const m = cenarioCpf(t, { emAberto: contas(12) });
  await enviarCpf();

  const rows = m.lista.mock.calls[0].arguments[6];
  assert.equal(rows.length, 10, "corta no teto de 10 linhas da Meta");

  const textos = m.text.mock.calls.map(c => c.arguments[3]);
  assert.ok(
    textos.some(t => t.includes("12") && t.includes("10")),
    "deve avisar quantas contas existem e quantas estão sendo mostradas"
  );
});

test("as contas são ordenadas da mais antiga para a mais recente", async (t) => {
  const m = cenarioCpf(t, {
    emAberto: [
      { linhaDigitavel: "novo", nossoNumero: 2, dataVencimento: "2026-08-10", valor: 200 },
      { linhaDigitavel: "antigo", nossoNumero: 1, dataVencimento: "2026-02-10", valor: 100 },
    ],
  });
  await enviarCpf();

  const corpo = m.botoes.mock.calls[0].arguments[3];
  assert.ok(
    corpo.indexOf("10/02/2026") < corpo.indexOf("10/08/2026"),
    "a conta mais antiga deve vir primeiro"
  );
});

test("sem contas em aberto mas com histórico: cliente está em dia", async (t) => {
  const m = cenarioCpf(t, { emAberto: [], historico: contas(2) });
  await enviarCpf();

  const textos = m.text.mock.calls.map(c => c.arguments[3]);
  assert.ok(
    textos.some(t => t.startsWith("Boa notícia")),
    "deve informar que o cliente está em dia"
  );
  assert.ok(
    textos.some(t => t.includes("111.***.**7-35")),
    "deve ecoar o CPF mascarado"
  );
  assert.ok(
    !textos.some(t => t.includes(CPF_VALIDO)),
    "não deve ecoar o CPF completo"
  );
});

test("sem contas em aberto e sem histórico: CPF fora do cadastro", async (t) => {
  const m = cenarioCpf(t, { emAberto: [], historico: [] });
  await enviarCpf();

  const textos = m.text.mock.calls.map(c => c.arguments[3]);
  assert.ok(
    textos.includes(constantsRef.MSG_CPF_NAO_ENCONTRADO),
    "deve dizer que não localizou o CPF no cadastro"
  );
});

test("histórico indisponível cai no texto genérico, sem afirmar que o CPF não existe", async (t) => {
  const m = cenarioCpf(t, { emAberto: [], historicoFalha: true });
  await enviarCpf();

  const textos = m.text.mock.calls.map(c => c.arguments[3]);
  assert.ok(textos.includes(constantsRef.MSG_NENHUM_BOLETO), "deve usar o texto genérico");
  assert.ok(
    !textos.includes(constantsRef.MSG_CPF_NAO_ENCONTRADO),
    "não pode afirmar que o CPF é desconhecido quando a consulta falhou"
  );
});

test("CPF inválido recebe o texto de CPF incorreto, não o de conta inexistente", async (t) => {
  const m = cenarioCpf(t, { emAberto: contas(1) });
  await require("../services/conversation").handleMessage("phone-id-123", {
    from: "5531999999999",
    id: "wamid.test.cpfruim",
    timestamp: "1748000031",
    type: "text",
    text: { body: "12345678900" },
  });

  const textos = m.text.mock.calls.map(c => c.arguments[3]);
  assert.deepEqual(textos, [constantsRef.MSG_CPF_INVALIDO]);
});

test("menu principal não oferece mais falar com atendente", async (t) => {
  const Cache = require("../services/redis");
  const GraphApi = require("../services/graph-api");
  const interacao = require("../services/interacaoClient");

  t.mock.method(Cache, "getEstado", async () => null);
  t.mock.method(interacao, "registrar", () => {});
  const botoes = t.mock.method(GraphApi, "messageWithInteractiveReply", async () => {});

  await require("../services/conversation").handleMessage("phone-id-123", {
    from: "5531999999999",
    id: "wamid.test.menu",
    timestamp: "1748000040",
    type: "text",
    text: { body: "oi" },
  });

  const opcoes = botoes.mock.calls[0].arguments[4];
  assert.equal(opcoes.length, 1, "o menu deve ter um único botão");
  assert.equal(opcoes[0].id, constantsRef.REPLY_SEGUNDA_VIA_ID);
});

// ── proteções: fallback de envio, estado, número digitado ────────────────────

test("Meta recusando a lista cai para texto com instrução de número", async (t) => {
  const GraphApi = require("../services/graph-api");
  const Cache = require("../services/redis");
  const m = cenarioCpf(t, { emAberto: contas(5) });
  t.mock.method(GraphApi, "messageWithInteractiveList", async () => {
    throw new Error("(#131009) Parameter value is not valid");
  });
  const setEstado = t.mock.method(Cache, "setEstado", async () => {});

  await enviarCpf();

  const textos = m.text.mock.calls.map(c => c.arguments[3]);
  const fallback = textos.find(t => t.includes("Responda com o"));
  assert.ok(fallback, "deve enviar a lista como texto simples");
  assert.match(fallback, /1\)/, "o texto deve trazer as contas enumeradas");
  assert.ok(
    setEstado.mock.calls.some(c => c.arguments[1] === "aguardando_selecao_boleto"),
    "o fallback chegou ao cliente, então o estado deve ser gravado"
  );
});

test("se nem o texto sair, o estado não fica gravado (cliente não fica preso)", async (t) => {
  const GraphApi = require("../services/graph-api");
  const Cache = require("../services/redis");
  cenarioCpf(t, { emAberto: contas(5) });
  t.mock.method(GraphApi, "messageWithInteractiveList", async () => {
    throw new Error("falha no envio interativo");
  });
  // Só o envio do fallback falha — a mensagem de "Aguarde..." precisa passar
  // para o fluxo chegar até o ponto que queremos exercitar.
  t.mock.method(GraphApi, "messageWithText", async (_id, _phone, _to, texto) => {
    if (String(texto).includes("Responda com o")) throw new Error("falha no envio de texto");
  });
  const setEstado = t.mock.method(Cache, "setEstado", async () => {});
  const clearEstado = t.mock.method(Cache, "clearEstado", async () => {});

  await enviarCpf();

  assert.ok(
    !setEstado.mock.calls.some(c => c.arguments[1] === "aguardando_selecao_boleto"),
    "não pode marcar aguardando_selecao_boleto sem o cliente ter visto a lista"
  );
  assert.ok(clearEstado.mock.calls.length >= 1, "deve limpar o estado");
});

test("cliente escolhe a conta digitando o número", async (t) => {
  const Cache = require("../services/redis");
  const GraphApi = require("../services/graph-api");
  const interacao = require("../services/interacaoClient");
  const sicoobClient = require("../services/sicoobClient");

  t.mock.method(Cache, "getEstado", async () => "aguardando_selecao_boleto");
  t.mock.method(Cache, "getBoletos", async () => [
    { linhaDigitavel: "L0", dataVencimentoOriginal: "2026-05-16", valorPagar: 76.97 },
    { linhaDigitavel: "L1", dataVencimentoOriginal: "2026-05-20", valorPagar: 379.89 },
  ]);
  t.mock.method(Cache, "setEstado", async () => {});
  t.mock.method(Cache, "setBoletos", async () => {});
  t.mock.method(interacao, "registrar", () => {});
  const segundaVia = t.mock.method(sicoobClient, "segundaViaBoleto", async () => ({
    body: { ok: true, result: { response: { resultado: {
      pdfBoleto: "JVBERi0=", valor: 379.89, dataVencimento: "2026-06-17", linhaDigitavel: "L1",
    } } } },
  }));
  t.mock.method(GraphApi, "uploadMedia", async () => ({ id: "media-1" }));
  const doc = t.mock.method(GraphApi, "messageWithDocument", async () => {});
  t.mock.method(GraphApi, "messageWithText", async () => {});

  await require("../services/conversation").handleMessage("phone-id-123", {
    from: "5531999999999", id: "wamid.num", timestamp: "1748000050",
    type: "text", text: { body: "2" },
  });

  assert.equal(doc.mock.calls.length, 1, "deve entregar o PDF da conta escolhida");
  assert.equal(
    segundaVia.mock.calls[0].arguments[0].linhaDigitavel, "L1",
    "digitar 2 deve escolher a SEGUNDA conta"
  );
});

test("resposta incompreensível pede de novo e mantém a sessão", async (t) => {
  const Cache = require("../services/redis");
  const GraphApi = require("../services/graph-api");
  const interacao = require("../services/interacaoClient");

  t.mock.method(Cache, "getEstado", async () => "aguardando_selecao_boleto");
  t.mock.method(Cache, "getBoletos", async () => [
    { linhaDigitavel: "L0", dataVencimentoOriginal: "2026-05-16", valorPagar: 76.97 },
  ]);
  const setEstado = t.mock.method(Cache, "setEstado", async () => {});
  t.mock.method(Cache, "setBoletos", async () => {});
  const clearEstado = t.mock.method(Cache, "clearEstado", async () => {});
  t.mock.method(interacao, "registrar", () => {});
  const text = t.mock.method(GraphApi, "messageWithText", async () => {});

  await require("../services/conversation").handleMessage("phone-id-123", {
    from: "5531999999999", id: "wamid.ruim", timestamp: "1748000060",
    type: "text", text: { body: "quero a primeira conta" },
  });

  const enviado = text.mock.calls[0].arguments[3];
  assert.match(enviado, /Não entendi/, "deve pedir de novo");
  assert.ok(
    !enviado.includes("fora do ar"),
    "não pode alegar falha de sistema quando foi só resposta não entendida"
  );
  assert.equal(clearEstado.mock.calls.length, 0, "não pode encerrar a sessão");
  assert.ok(
    setEstado.mock.calls.some(c => c.arguments[1] === "aguardando_selecao_boleto"),
    "deve renovar o TTL da sessão"
  );
});

test("falha inesperada no fluxo avisa o cliente em vez de silêncio", async (t) => {
  const GraphApi = require("../services/graph-api");
  const Conversation = require("../services/conversation");
  const text = t.mock.method(GraphApi, "messageWithText", async () => {});

  await Conversation.avisarFalhaInesperada("phone-id-123", { from: "5531999999999" });

  assert.equal(text.mock.calls.length, 1);
  assert.equal(text.mock.calls[0].arguments[3], constantsRef.MSG_ERRO_INESPERADO);
});

test("aviso de falha não tenta enviar sem destinatário", async (t) => {
  const GraphApi = require("../services/graph-api");
  const Conversation = require("../services/conversation");
  const text = t.mock.method(GraphApi, "messageWithText", async () => {});

  await Conversation.avisarFalhaInesperada("phone-id-123", {});

  assert.equal(text.mock.calls.length, 0);
});
