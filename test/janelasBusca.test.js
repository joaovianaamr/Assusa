"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

// sicoobClient só usa fetch e config — pode ser carregado sem Redis nem rede.
const sicoob = require("../services/sicoobClient");

const DIA_MS = 86400000;
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / DIA_MS);
const REFERENCIA = new Date("2026-07-28T12:00:00Z");

const janelas = () => sicoob.montarJanelas(REFERENCIA);

test("nenhuma janela ultrapassa o limite de 35 dias do Sicoob", () => {
  for (const j of janelas()) {
    const span = dias(j.dataInicio, j.dataFim);
    assert.ok(
      span <= sicoob.LIMITE_SICOOB_DIAS,
      `janela ${j.dataInicio}→${j.dataFim} tem ${span} dias (erro 5002 do Sicoob)`
    );
  }
});

test("as janelas são contíguas — sem buraco e sem sobreposição", () => {
  const js = janelas();
  for (let i = 1; i < js.length; i++) {
    // js[i] é mais antiga: seu fim deve ser o dia anterior ao início da js[i-1]
    assert.equal(
      dias(js[i].dataFim, js[i - 1].dataInicio), 1,
      `buraco/sobreposição entre ${js[i].dataFim} e ${js[i - 1].dataInicio}`
    );
  }
});

test("a busca alcança boletos com vencimento FUTURO", () => {
  const js = janelas();
  const maisFuturo = js[0].dataFim;
  assert.ok(
    dias(REFERENCIA.toISOString().slice(0, 10), maisFuturo) > 0,
    `a janela mais recente termina em ${maisFuturo}, sem cobrir vencimentos futuros`
  );
  assert.equal(dias(REFERENCIA.toISOString().slice(0, 10), maisFuturo), sicoob.DIAS_FUTURO);
});

test("a janela mais recente começa hoje — o futuro é coberto por inteiro", () => {
  assert.equal(janelas()[0].dataInicio, "2026-07-28");
});

test("a cobertura para trás alcança a inadimplência típica (>= 175 dias)", () => {
  const js = janelas();
  const maisAntigo = js[js.length - 1].dataInicio;
  assert.ok(
    dias(maisAntigo, REFERENCIA.toISOString().slice(0, 10)) >= 175,
    `cobertura passada de apenas ${dias(maisAntigo, REFERENCIA.toISOString().slice(0, 10))} dias`
  );
});

test("gera exatamente NUM_JANELAS requisições", () => {
  assert.equal(janelas().length, sicoob.NUM_JANELAS);
});

test("todas as datas saem no formato yyyy-MM-dd", () => {
  for (const j of janelas()) {
    assert.match(j.dataInicio, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(j.dataFim, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("o padrão respeita o teto da API mesmo se a env pedir mais", () => {
  assert.ok(sicoob.DIAS_POR_JANELA <= sicoob.LIMITE_SICOOB_DIAS);
});

test("a virada de ano não quebra a sequência", () => {
  const js = sicoob.montarJanelas(new Date("2026-01-05T12:00:00Z"));
  for (let i = 1; i < js.length; i++) {
    assert.equal(dias(js[i].dataFim, js[i - 1].dataInicio), 1);
    assert.ok(dias(js[i].dataInicio, js[i].dataFim) <= sicoob.LIMITE_SICOOB_DIAS);
  }
  assert.ok(js[js.length - 1].dataInicio < "2026-01-05", "deve alcançar 2025");
});
