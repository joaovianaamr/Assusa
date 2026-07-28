"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

/**
 * O ponto desta fase da migração: importar já não abre socket.
 *
 * Antes, `require` de sessaoRedis (então services/redis.js) chamava
 * `client.connect()` no topo do módulo. Quem importasse `conversation.js`
 * conectava ao Redis sem pedir, e três defesas no repo existiam só para
 * contornar isso — inclusive um teste que lia código-fonte como texto.
 *
 * Se alguém devolver a conexão para o topo do arquivo, este teste falha.
 */

test("importar o adapter não conecta ao Redis", () => {
  const Cache = require("../api/infrastructure/sessaoRedis");
  assert.equal(
    Cache._conectado(), false,
    "o socket não pode ser aberto no require — a conexão é preguiçosa"
  );
});

test("a cadeia inteira pode ser importada sem Redis de pé", () => {
  // conversation.js puxa o adapter; nada disso deve tocar a rede.
  const Cache = require("../api/infrastructure/sessaoRedis");
  require("../services/conversation");
  assert.equal(
    Cache._conectado(), false,
    "importar conversation.js não pode conectar ao Redis"
  );
});

test("o adapter expõe a interface de sessão que a aplicação espera", () => {
  const Cache = require("../api/infrastructure/sessaoRedis");
  for (const metodo of [
    "getEstado", "setEstado", "clearEstado",
    "getBoletos", "setBoletos", "clearBoletos",
    "insert", "remove",
  ]) {
    assert.equal(typeof Cache[metodo], "function", `falta ${metodo}`);
  }
});
