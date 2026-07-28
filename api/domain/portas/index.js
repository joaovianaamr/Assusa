/**
 * Portas — o que o domínio exige do mundo externo.
 *
 * JavaScript não tem interface, então uma "porta" aqui é a lista de operações
 * que um adapter precisa oferecer, mais um verificador. Sem isso a porta seria
 * só comentário: com ele, `test/portas.test.js` falha quando um adapter deixa
 * de cumprir o contrato, que é o ponto de ter porta.
 *
 * A regra de dependência: quem define o contrato é o domínio; infrastructure
 * implementa. Por isso este arquivo não importa nenhum adapter.
 */

"use strict";

/** Consulta de boletos no banco (implementada por infrastructure/sicoobHttp). */
const BOLETOS = {
  nome: "Boletos",
  operacoes: ["listarBoletos", "segundaViaBoleto"],
};

/** Sessão da conversa (implementada por infrastructure/sessaoRedis). */
const SESSAO = {
  nome: "Sessao",
  operacoes: [
    "getEstado", "setEstado", "clearEstado",
    "getBoletos", "setBoletos", "clearBoletos",
  ],
};

/** Envio de mensagens ao cliente (implementada por infrastructure/whatsappGraph). */
const NOTIFICADOR = {
  nome: "Notificador",
  operacoes: [
    "messageWithText",
    "messageWithInteractiveReply",
    "messageWithInteractiveList",
    "messageWithDocument",
    "uploadMedia",
  ],
};

/** Registro de eventos de atendimento (implementada por infrastructure/telemetriaHttp). */
const TELEMETRIA = {
  nome: "Telemetria",
  operacoes: ["registrar"],
};

/**
 * Lista as operações que faltam para `adapter` cumprir `porta`.
 * Vazio significa contrato cumprido.
 *
 * @returns {string[]}
 */
function operacoesFaltando(porta, adapter) {
  if (!adapter) return [...porta.operacoes];
  return porta.operacoes.filter(op => typeof adapter[op] !== "function");
}

module.exports = { BOLETOS, SESSAO, NOTIFICADOR, TELEMETRIA, operacoesFaltando };
