"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const portas = require("../api/domain/portas");

/**
 * Cada adapter de infrastructure precisa cumprir a porta que o domínio define.
 * Sem este teste, "porta" seria só um comentário: renomear um método no adapter
 * passaria despercebido até quebrar em produção.
 */
const contratos = [
  [portas.BOLETOS,     "../api/infrastructure/sicoobHttp"],
  [portas.SESSAO,      "../api/infrastructure/sessaoRedis"],
  [portas.NOTIFICADOR, "../api/infrastructure/whatsappGraph"],
  [portas.TELEMETRIA,  "../api/infrastructure/telemetriaHttp"],
];

for (const [porta, caminho] of contratos) {
  test(`${caminho.split("/").pop()} cumpre a porta ${porta.nome}`, () => {
    const adapter = require(caminho);
    const faltando = portas.operacoesFaltando(porta, adapter);
    assert.deepEqual(faltando, [], `operações ausentes: ${faltando.join(", ")}`);
  });
}

test("operacoesFaltando aponta o que falta", () => {
  const parcial = { getEstado: () => {}, setEstado: () => {} };
  const faltando = portas.operacoesFaltando(portas.SESSAO, parcial);
  assert.ok(faltando.includes("clearEstado"));
  assert.ok(!faltando.includes("getEstado"));
});

test("operacoesFaltando trata adapter ausente", () => {
  assert.deepEqual(
    portas.operacoesFaltando(portas.TELEMETRIA, null),
    ["registrar"]
  );
});
