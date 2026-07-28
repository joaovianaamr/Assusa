/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

module.exports = class Message {
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
};
