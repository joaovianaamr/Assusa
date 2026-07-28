"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

// Antes este teste lia conversation.js como TEXTO e extraía a função com regex,
// para não disparar a conexão com o Redis que o require daquele módulo provoca.
// Com a regra isolada no domínio, o require é direto — api/domain/ é puro.
const { apenasDigitos, cpfValido, mascararCpf } = require("../api/domain/cpf");

// ── válidos ───────────────────────────────────────────────────────────────────

test("CPF válido — apenas dígitos (111.444.777-35, sintético)", () => {
  assert.ok(cpfValido("11144477735"));
});

test("CPF válido — gerado algoritmicamente (529.982.247-25)", () => {
  assert.ok(cpfValido("52998224725"));
});

test("CPF válido — segundo dígito verificador = 0 (100.000.002-80)", () => {
  assert.ok(cpfValido("10000000280"));
});

// ── inválidos — dígito verificador errado ────────────────────────────────────

test("CPF inválido — primeiro dígito verificador errado", () => {
  assert.ok(!cpfValido("11144477725"));  // penúltimo trocado
});

test("CPF inválido — segundo dígito verificador errado", () => {
  assert.ok(!cpfValido("11144477736"));  // último trocado
});

test("CPF inválido — todos os dígitos trocados", () => {
  assert.ok(!cpfValido("12345678900"));
});

// ── inválidos — sequências repetidas ─────────────────────────────────────────

test("CPF inválido — 000.000.000-00", () => {
  assert.ok(!cpfValido("00000000000"));
});

test("CPF inválido — 111.111.111-11", () => {
  assert.ok(!cpfValido("11111111111"));
});

test("CPF inválido — 999.999.999-99", () => {
  assert.ok(!cpfValido("99999999999"));
});

// ── inválidos — comprimento errado ───────────────────────────────────────────

test("CPF inválido — menos de 11 dígitos", () => {
  assert.ok(!cpfValido("1234567890"));
});

test("CPF inválido — mais de 11 dígitos", () => {
  assert.ok(!cpfValido("111444777350"));
});

test("CPF inválido — string vazia", () => {
  assert.ok(!cpfValido(""));
});

// ── normalização da entrada (antes vivia solta em conversation.js) ───────────

test("apenasDigitos aceita qualquer pontuação", () => {
  for (const entrada of [
    "11144477735", "111.444.777-35", "111 444 777 35",
    "111-444-777-35", "111.444.777.35", "meu cpf e 111.444.777-35",
  ]) {
    assert.equal(apenasDigitos(entrada), "11144477735", `falhou para ${entrada}`);
  }
});

test("apenasDigitos tolera entrada ausente", () => {
  assert.equal(apenasDigitos(null), "");
  assert.equal(apenasDigitos(undefined), "");
});

// ── máscara (migrada de boletoView: é regra de CPF, não de boleto) ───────────

test("mascararCpf esconde o miolo do documento", () => {
  assert.equal(mascararCpf("12345678900"), "123.***.**9-00");
});

test("mascararCpf aceita CPF já formatado", () => {
  assert.equal(mascararCpf("123.456.789-00"), "123.***.**9-00");
});

test("mascararCpf devolve vazio para entrada de tamanho errado", () => {
  assert.equal(mascararCpf("123"), "");
  assert.equal(mascararCpf(null), "");
});
