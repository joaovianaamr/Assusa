/**
 * Fachada da conversa — mantida para não quebrar quem já a chama.
 *
 * O conteúdo migrou para api/: as regras estão em `domain/`, os casos de uso em
 * `application/`, os adapters em `infrastructure/` e o roteamento em
 * `interface/webhookRouter.js`. Este arquivo hoje só repassa para o objeto
 * montado no composition root.
 *
 * Era um módulo de 655 linhas que importava 9 dos 10 módulos internos e
 * acumulava máquina de estados, regra de negócio, apresentação e I/O.
 */

"use strict";

const { router } = require("../api/composicao");

module.exports = class Conversation {
  static handleMessage(senderPhoneNumberId, rawMessage) {
    return router.handleMessage(senderPhoneNumberId, rawMessage);
  }

  static handleStatus(senderPhoneNumberId, rawStatus) {
    return router.handleStatus(senderPhoneNumberId, rawStatus);
  }

  static avisarFalhaInesperada(senderPhoneNumberId, rawMessage) {
    return router.avisarFalhaInesperada(senderPhoneNumberId, rawMessage);
  }
};
