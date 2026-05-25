"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

// Extrai a função sem carregar dependências do módulo inteiro
const src = require("fs").readFileSync(
  require("path").join(__dirname, "../services/conversation.js"),
  "utf8"
);
const fnBody = src.match(/function cpfValido[\s\S]+?^}/m)[0];
const cpfValido = new Function(`return (${fnBody})`)();

// ── válidos ───────────────────────────────────────────────────────────────────

test("CPF válido — apenas dígitos", () => {
  assert.ok(cpfValido("15421449149"));
});

test("CPF válido — gerado algoritmicamente (529.982.247-25)", () => {
  assert.ok(cpfValido("52998224725"));
});

test("CPF válido — segundo dígito verificador = 0 (100.000.002-80)", () => {
  assert.ok(cpfValido("10000000280"));
});

// ── inválidos — dígito verificador errado ────────────────────────────────────

test("CPF inválido — primeiro dígito verificador errado", () => {
  assert.ok(!cpfValido("15421449139"));  // penúltimo trocado
});

test("CPF inválido — segundo dígito verificador errado", () => {
  assert.ok(!cpfValido("15421449148"));  // último trocado
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
  assert.ok(!cpfValido("154214491490"));
});

test("CPF inválido — string vazia", () => {
  assert.ok(!cpfValido(""));
});
