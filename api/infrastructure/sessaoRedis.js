/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const redis = require('redis');
const config = require('../config');

/**
 * A conexão é criada na PRIMEIRA operação, não ao importar o módulo.
 *
 * Antes, `require` deste arquivo já abria o socket. Isso contaminava toda a
 * cadeia: quem importasse `conversation.js` conectava ao Redis sem pedir, e três
 * defesas existiam só para contornar o efeito — o `require` tardio dentro do
 * handler em `app.js`, o cuidado no `webhook.test.js` e a leitura do
 * `conversation.js` como texto no `cpf.test.js`.
 *
 * Com a criação preguiçosa, importar não faz I/O. Continua havendo um único
 * cliente por processo, aberto quando o primeiro comando chega.
 */
let client = null;

function conectar() {
  if (client) return client;

  client = redis.createClient({
    socket: {
      host: config.redisHost,
      port: config.redisPort
    }
  });

  client.on('error', (err) => {
    console.error('Redis Client Error', err);
  });

  client.connect();
  return client;
}

/** Exposto para teste: revela se o socket já foi aberto. */
function _conectado() {
  return client !== null;
}

class Cache {
    static async insert(key) {
        /**
         * As of when this was written, the redis client doesn't support
         * setting a TTL on members of the set dataytype. Instead, we'll
         * use the standard hash map with a dummy value to mimic one.
        */
        await conectar().set(key, "");

        // Assume that most "delivered / read" webhooks will happen within
        // 15 seconds.
        await conectar().expire(key, 15);
    }

    static async remove(key) {
        let resp = await conectar().del(key);

        /**
         * Optionally, your application can measure / report the ingress latency
         * from Cloud API webhooks via Redis's TTL.
         * Ex.
         *      someLoggingFunc(client.ttl(key));
        */

        return resp > 0;
    }

    static async setEstado(phoneNumber, estado) {
        const key = `estado:${phoneNumber}`;
        await conectar().set(key, estado, { EX: config.estadoTtlSeconds });
    }

    static async getEstado(phoneNumber) {
        const key = `estado:${phoneNumber}`;
        return await conectar().get(key);
    }

    static async clearEstado(phoneNumber) {
        const key = `estado:${phoneNumber}`;
        await conectar().del(key);
    }

    static async setBoletos(phoneNumber, boletos) {
        const key = `boletos:${phoneNumber}`;
        await conectar().set(key, JSON.stringify(boletos), { EX: config.estadoTtlSeconds });
    }

    static async getBoletos(phoneNumber) {
        const key = `boletos:${phoneNumber}`;
        const raw = await conectar().get(key);
        return raw ? JSON.parse(raw) : null;
    }

    static async clearBoletos(phoneNumber) {
        const key = `boletos:${phoneNumber}`;
        await conectar().del(key);
    }

    /**
     * Códigos da última conta entregue (linha digitável e PIX copia e cola).
     *
     * Guardados porque a lista de facilidades entrega o código SOB DEMANDA: o
     * toque chega minutos depois do PDF, e sem isto seria preciso consultar o
     * Sicoob de novo a cada toque.
     */
    static async setCodigos(phoneNumber, codigos) {
        const key = `codigos:${phoneNumber}`;
        await conectar().set(key, JSON.stringify(codigos), { EX: config.estadoTtlSeconds });
    }

    static async getCodigos(phoneNumber) {
        const key = `codigos:${phoneNumber}`;
        const raw = await conectar().get(key);
        return raw ? JSON.parse(raw) : null;
    }

    static async clearCodigos(phoneNumber) {
        const key = `codigos:${phoneNumber}`;
        await conectar().del(key);
    }
}

module.exports = Cache;
module.exports._conectado = _conectado;
