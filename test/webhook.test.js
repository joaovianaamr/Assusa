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
