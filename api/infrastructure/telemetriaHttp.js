/**
 * Adapter da porta Telemetria — registra o que aconteceu no atendimento.
 *
 * Grava na tabela `interacoes` do Postgres, através do serviço Python
 * (`POST /interno/interacao`). É a origem dos números que respondem perguntas de
 * negócio: quantos clientes chegam a pedir a 2ª via, quantos desistem no CPF,
 * quantos usam o botão "Ver outras contas".
 *
 * Camada infrastructure: implementa `portas.TELEMETRIA` (uma operação,
 * `registrar`). Os casos de uso recebem isto como `telemetria` e não sabem que
 * há Postgres do outro lado.
 */

"use strict";

function baseUrl() {
  const u = process.env.SICOOB_SERVICE_URL;
  return u ? String(u).replace(/\/$/, "") : null;
}

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Internal-Api-Key": process.env.INTERNAL_API_KEY || "",
  };
}

/**
 * Registra um evento. **Fire-and-forget de propósito: não é `async` e não
 * devolve promessa.**
 *
 * Telemetria nunca pode atrasar nem derrubar o atendimento — se o Postgres cair,
 * o cliente ainda recebe o boleto. Por isso a chamada não é aguardada, o erro é
 * engolido e há timeout de 5 s.
 *
 * A contrapartida a conhecer: como nada é aguardado, um processo que encerre
 * logo depois (um script de teste com `process.exit()`, por exemplo) mata a
 * requisição antes de ela sair, e o evento se perde. Em produção isso não ocorre
 * porque o servidor segue vivo.
 *
 * @param {string} telefone   número do cliente (E.164 sem `+`)
 * @param {string} evento     nome em maiúsculas — ver a tabela em docs/fluxo-mensagens.md
 * @param {string|null} cpf   CPF, quando o evento é sobre uma consulta
 * @param {object|null} detalhes payload livre com contexto do evento
 */
function registrar(telefone, evento, cpf = null, detalhes = null) {
  const b = baseUrl();
  if (!b) return;   // sem serviço configurado, telemetria é simplesmente ignorada
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  fetch(`${b}/interno/interacao`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ telefone, evento, cpf, detalhes }),
    signal: controller.signal,
  }).then(() => clearTimeout(timer)).catch(() => clearTimeout(timer));
}

module.exports = { registrar };
