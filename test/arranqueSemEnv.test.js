"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

/**
 * O processo precisa subir sem NENHUMA variável de ambiente.
 *
 * É assim que o container roda no CI: `docker run` sem `--env-file`. Um adapter
 * que faça trabalho no import quebra ali e em nenhum outro lugar — foi o que
 * aconteceu quando `new FacebookAdsApi(config.accessToken)` estava no topo do
 * whatsappGraph: lança "Access token required" com token indefinido, o
 * container morreu no arranque e o smoke test do CI reprovou.
 *
 * Os demais testes não pegam isso porque definem ACCESS_TOKEN, e no
 * desenvolvimento local o `.env` existe. Este roda um processo limpo de verdade.
 */

const raiz = path.join(__dirname, "..");

/** Executa um trecho em processo separado, sem herdar env nem ler o .env. */
function nodeLimpo(codigo) {
  return execFileSync(process.execPath, ["-e", codigo], {
    cwd: raiz,
    env: { PATH: process.env.PATH, DOTENV_CONFIG_PATH: "/dev/null" },
    encoding: "utf8",
    timeout: 30000,
  });
}

test("o composition root monta sem nenhuma variável de ambiente", () => {
  const saida = nodeLimpo(`
    require("./api/composicao");
    console.log("montou");
  `);
  assert.match(saida, /montou/);
});

test("createApp() funciona sem variáveis de ambiente", () => {
  const saida = nodeLimpo(`
    const { createApp } = require("./app");
    const app = createApp();
    console.log(typeof app === "function" ? "app criado" : "falhou");
  `);
  assert.match(saida, /app criado/);
});

test("nenhum adapter faz trabalho ao ser importado", () => {
  const saida = nodeLimpo(`
    const redis = require("./api/infrastructure/sessaoRedis");
    const graph = require("./api/infrastructure/whatsappGraph");
    require("./api/composicao");
    console.log(JSON.stringify({
      redisConectado: redis._conectado(),
      sdkInstanciado: graph._instanciado(),
    }));
  `);
  const estado = JSON.parse(saida.trim().split("\n").pop());
  assert.equal(estado.redisConectado, false, "o Redis não pode conectar no import");
  assert.equal(estado.sdkInstanciado, false, "o SDK da Meta não pode ser construído no import");
});
