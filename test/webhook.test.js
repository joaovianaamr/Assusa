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

test("aguardando_cpf + button assusa-segunda-via reinicia o fluxo com MSG_SOLICITAR_CPF", async (t) => {
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

  assert.equal(mockText.mock.calls.length, 1, "messageWithText deve ser chamado uma vez");
  assert.equal(
    mockText.mock.calls[0].arguments[3],
    constants.MSG_SOLICITAR_CPF,
    "deve enviar MSG_SOLICITAR_CPF"
  );
});
