"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

// boletoView é puro: não conecta ao Redis nem à rede, então pode ser
// carregado com require normal (ao contrário de conversation.js).
const view = require("../services/boletoView");
const constants = require("../services/constants");

const boleto = (dataVencimentoOriginal, valorPagar) => ({
  dataVencimentoOriginal,
  valorPagar,
  linhaDigitavel: "00000000000000000000000000000000000000000000000",
});

const listaDe = n =>
  Array.from({ length: n }, (_, i) =>
    boleto(`2026-0${(i % 9) + 1}-1${i % 9}`, 1234.5 + i)
  );

// ── formatação ───────────────────────────────────────────────────────────────

test("formatarData converte ISO para dd/mm/aaaa", () => {
  assert.equal(view.formatarData("2026-03-10"), "10/03/2026");
});

test("formatarData tolera valor ausente", () => {
  assert.equal(view.formatarData(null), "—");
  assert.equal(view.formatarData(undefined), "—");
});

test("formatarDataCurta omite o ano", () => {
  assert.equal(view.formatarDataCurta("2026-03-10"), "10/03");
});

test("formatarBRL usa vírgula decimal e duas casas", () => {
  assert.equal(view.formatarBRL(128.4), "128,40");
  assert.equal(view.formatarBRL(0), "0,00");
});

test("formatarBRL tolera valor inválido", () => {
  assert.equal(view.formatarBRL(null), "—");
  assert.equal(view.formatarBRL("abc"), "—");
});

// ── máscara de CPF ───────────────────────────────────────────────────────────

test("mascararCpf esconde o miolo do documento", () => {
  assert.equal(view.mascararCpf("12345678900"), "123.***.**9-00");
});

test("mascararCpf aceita CPF já formatado", () => {
  assert.equal(view.mascararCpf("123.456.789-00"), "123.***.**9-00");
});

test("mascararCpf devolve vazio para entrada de tamanho errado", () => {
  assert.equal(view.mascararCpf("123"), "");
  assert.equal(view.mascararCpf(null), "");
});

// ── decisão botões vs. lista ─────────────────────────────────────────────────

test("até 3 contas usa botões", () => {
  assert.equal(view.deveUsarLista(1), false);
  assert.equal(view.deveUsarLista(3), false);
});

test("a partir de 4 contas usa lista", () => {
  assert.equal(view.deveUsarLista(4), true);
  assert.equal(view.deveUsarLista(10), true);
});

// ── corpo enumerado ──────────────────────────────────────────────────────────

test("montarLinhasBoletos numera a partir de 1 e mostra data e valor", () => {
  const linhas = view.montarLinhasBoletos([
    boleto("2026-03-10", 128.4),
    boleto("2026-04-10", 130),
  ]).split("\n");

  assert.equal(linhas.length, 2);
  assert.match(linhas[0], /^1\)/);
  assert.match(linhas[0], /10\/03\/2026/);
  assert.match(linhas[0], /128,40/);
  assert.match(linhas[1], /^2\)/);
});

// ── botões ───────────────────────────────────────────────────────────────────

test("montarBotoesBoletos respeita o teto de 3 botões da Meta", () => {
  assert.equal(view.montarBotoesBoletos(listaDe(10)).length, view.MAX_BOTOES);
});

test("títulos de botão cabem no limite de 20 caracteres", () => {
  for (const b of view.montarBotoesBoletos(listaDe(3))) {
    assert.ok(
      b.title.length <= view.LIMITE_TITULO_BOTAO,
      `título longo demais: ${b.title}`
    );
  }
});

// ── lista interativa ─────────────────────────────────────────────────────────

test("montarRowsLista respeita o teto de 10 linhas da Meta", () => {
  assert.equal(view.montarRowsLista(listaDe(25)).length, view.MAX_ROWS);
});

test("linhas da lista cabem nos limites de título e descrição", () => {
  for (const row of view.montarRowsLista(listaDe(10))) {
    assert.ok(
      row.title.length <= view.LIMITE_TITULO_ROW,
      `título longo demais: ${row.title}`
    );
    assert.ok(
      row.description.length <= view.LIMITE_DESCRICAO_ROW,
      `descrição longa demais: ${row.description}`
    );
  }
});

test("botões e linhas usam o mesmo id, para o handler tratar os dois igual", () => {
  const contas = listaDe(3);
  const ids = view.montarBotoesBoletos(contas).map(b => b.id);
  assert.deepEqual(ids, view.montarRowsLista(contas).map(r => r.id));
  assert.deepEqual(ids, [0, 1, 2].map(i => `${constants.REPLY_BOLETO_PREFIX}${i}`));
});

test("a descrição da linha traz o valor atualizado", () => {
  const [row] = view.montarRowsLista([boleto("2026-03-10", 128.4)]);
  assert.match(row.description, /128,40/);
});

// ── teto de exibição ─────────────────────────────────────────────────────────

test("o teto de contas exibidas é o teto de linhas da lista", () => {
  assert.equal(view.MAX_BOLETOS_EXIBIDOS, view.MAX_ROWS);
});

test("truncar corta apenas o que passa do limite", () => {
  assert.equal(view.truncar("abc", 5), "abc");
  assert.equal(view.truncar("abcdef", 3), "abc");
});

test("corpo da seleção cabe no limite de 1024 caracteres da Meta", () => {
  const corpo = view.montarCorpoSelecao(
    constants.MSG_SELECIONAR_BOLETO_LISTA,
    listaDe(view.MAX_ROWS)
  );
  assert.ok(corpo.length <= view.LIMITE_CORPO, `corpo com ${corpo.length} chars`);
  assert.match(corpo, /10\)/, "deve enumerar até a décima conta");
});

// ── resolução da escolha (botão, lista ou número digitado) ───────────────────

test("resolverIndiceSelecao entende o id vindo de botão ou lista", () => {
  assert.equal(view.resolverIndiceSelecao({ type: "boleto-0" }, 3), 0);
  assert.equal(view.resolverIndiceSelecao({ type: "boleto-2" }, 3), 2);
});

test("resolverIndiceSelecao entende o número digitado (1-based)", () => {
  assert.equal(view.resolverIndiceSelecao({ type: "unknown", text: "1" }, 3), 0);
  assert.equal(view.resolverIndiceSelecao({ type: "unknown", text: " 3 " }, 3), 2);
  assert.equal(view.resolverIndiceSelecao({ type: "unknown", text: "10" }, 10), 9);
});

test("resolverIndiceSelecao recusa índice fora do intervalo", () => {
  assert.equal(view.resolverIndiceSelecao({ type: "boleto-5" }, 3), null);
  assert.equal(view.resolverIndiceSelecao({ type: "unknown", text: "0" }, 3), null);
  assert.equal(view.resolverIndiceSelecao({ type: "unknown", text: "4" }, 3), null);
});

test("resolverIndiceSelecao recusa texto que não é número", () => {
  assert.equal(view.resolverIndiceSelecao({ type: "unknown", text: "quero a primeira" }, 3), null);
  assert.equal(view.resolverIndiceSelecao({ type: "unknown", text: "" }, 3), null);
  assert.equal(view.resolverIndiceSelecao({ type: "unknown" }, 3), null);
});
