"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

// Os tradutores do payload são puros — sem Redis nem rede.
const { Message } = require("../api/interface/payloadWhatsApp");

test("clique em botão vira o id do botão", () => {
  const m = new Message({
    id: "wamid.1",
    from: "553100000000",
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: "boleto-0", title: "1 - Conta 10/03" } },
  });
  assert.equal(m.type, "boleto-0");
  assert.equal(m.senderPhoneNumber, "553100000000");
  assert.equal(m.id, "wamid.1");
});

test("clique em item de lista vira o id do item", () => {
  const m = new Message({
    id: "wamid.2",
    from: "553100000000",
    type: "interactive",
    interactive: { type: "list_reply", list_reply: { id: "boleto-7", title: "8) Conta 10/03/2026" } },
  });
  assert.equal(m.type, "boleto-7");
});

test("mensagem de texto livre expõe o texto e tipo unknown", () => {
  const m = new Message({
    id: "wamid.3",
    from: "553100000000",
    type: "text",
    text: { body: "12345678900" },
  });
  assert.equal(m.type, "unknown");
  assert.equal(m.text, "12345678900");
});

test("tipo interativo desconhecido não lança — cai em unknown", () => {
  const m = new Message({
    id: "wamid.4",
    from: "553100000000",
    type: "interactive",
    interactive: { type: "nfm_reply", nfm_reply: { response_json: "{}" } },
  });
  assert.equal(m.type, "unknown");
});

test("interactive ausente não lança", () => {
  const m = new Message({ id: "wamid.5", from: "553100000000", type: "interactive" });
  assert.equal(m.type, "unknown");
});
