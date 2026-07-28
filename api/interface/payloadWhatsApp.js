/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Tradutores do payload da Meta para o vocabulário do bot.
 *
 * Camada interface: é a fronteira de entrada. O que vem do webhook tem a forma
 * que a Meta escolheu; daqui para dentro o resto do sistema só vê `type`,
 * `text` e `senderPhoneNumber`.
 */

"use strict";

class Message {
  constructor(rawMessage) {
    this.id = rawMessage.id;
    this.text = rawMessage && rawMessage.text ? rawMessage.text.body : undefined;

    // Respostas interativas chegam como button_reply (mensagem de botões) ou
    // list_reply (lista interativa, usada quando há mais de 3 contas). Ler os
    // dois de forma defensiva: tipos futuros da Meta (nfm_reply etc.) não podem
    // derrubar o handler do webhook.
    const interactive = rawMessage.interactive;
    if (rawMessage.type === 'interactive' && interactive) {
      this.type =
        interactive.button_reply?.id ??
        interactive.list_reply?.id ??
        'unknown';
    } else {
      this.type = 'unknown';
    }

    this.senderPhoneNumber = rawMessage.from;
  }
}

class Status {
  constructor(rawStatus) {
    // The message ID that this status update refers to
    this.messageId = rawStatus.id;

    // The delivery status (sent, delivered, read, failed, etc.)
    this.status = rawStatus.status;

    // The recipient's phone number
    this.recipientPhoneNumber = rawStatus.recipient_id;
  }
}

module.exports = { Message, Status };
