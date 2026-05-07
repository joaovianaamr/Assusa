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
