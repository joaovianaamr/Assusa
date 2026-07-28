/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const crypto = require("crypto");

const { urlencoded, json } = require("body-parser");
require("dotenv").config();
const express = require("express");

const config = require("./api/config");
const sicoobClient = require("./api/infrastructure/sicoobHttp");
// O composition root monta o roteador da conversa com as portas já ligadas.
// Ficava dentro do handler do POST enquanto importar a cadeia conectava ao
// Redis; hoje a conexão é preguiçosa e um erro de import estoura no arranque,
// onde o rollback automático do deploy enxerga.
const { router } = require("./api/composicao");

function verifyRequestSignature(req, res, buf) {
  let signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    console.warn(`Couldn't find "x-hub-signature-256" in headers.`);
  } else {
    let elements = signature.split("=");
    let signatureHash = elements[1];
    let expectedHash = crypto
      .createHmac("sha256", config.appSecret)
      .update(buf)
      .digest("hex");
    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

function createApp() {
  const app = express();

  app.use(
    urlencoded({
      extended: true
    })
  );

  app.use(json({ verify: verifyRequestSignature }));

  // Arquivos de web/ são servidos por rota explícita, nunca por
  // express.static: o diretório inteiro não deve ficar exposto (ver CLAUDE.md —
  // uma cópia do código-fonte já ficou pública por semanas a partir daqui).
  app.get("/logo-assusa.png", (_req, res) => {
    res.sendFile(require("path").join(__dirname, "web", "logo-assusa.png"));
  });

  app.get("/privacy", (_req, res) => {
    res.sendFile(require("path").join(__dirname, "web", "privacy.html"));
  });

  app.get("/data-deletion", (_req, res) => {
    res.sendFile(require("path").join(__dirname, "web", "data-deletion.html"));
  });

  // TODO: implementar deleção real (remover do postgres e encerrar sessão Redis)
  app.post("/data-deletion", (req, res) => {
    const { phone, cpf } = req.body || {};
    console.log(`[data-deletion] solicitação recebida — phone: ${phone}, cpf: ${cpf}`);
    res.json({ status: "received", message: "Solicitação registrada. Dados serão excluídos em até 72 horas." });
  });

  // uso único para verificar a conexão com o whatsapp (handshake)
  app.get("/webhook", function (req, res) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const tokenMatched =
      typeof token === "string" &&
      typeof config.verifyToken === "string" &&
      token === config.verifyToken;
    const modeOk = mode === "subscribe";
    const challengeOk = typeof challenge === "string";

    console.log("Webhook verification", {
      mode: mode === undefined ? undefined : String(mode),
      tokenMatched,
      hasChallenge: challengeOk
    });

    if (!modeOk || !tokenMatched || !challengeOk) {
      return res.status(403).type("text/plain").send("Forbidden");
    }

    return res.status(200).type("text/plain").send(challenge);
  });

  // endpoint principal para receber eventos do whatsapp
  app.post("/webhook", (req, res) => {
    const body = req.body;
    const objectType =
      body && typeof body === "object" && typeof body.object === "string"
        ? body.object
        : undefined;
    const entryCount =
      body &&
      typeof body === "object" &&
      Array.isArray(body.entry)
        ? body.entry.length
        : 0;
    console.log("WhatsApp webhook POST", { object: objectType, entryCount });

    if (body && body.object === "whatsapp_business_account") {
      body.entry.forEach(entry => {
        entry.changes.forEach(change => {
          const value = change.value;
          if (value) {
            const senderPhoneNumberId = value.metadata.phone_number_id;

            if (value.statuses) {
              value.statuses.forEach(status => {
                router.handleStatus(senderPhoneNumberId, status).catch(err =>
                  console.error('handleStatus error:', err?.message)
                );
              });
            }

            if (value.messages) {
              value.messages.forEach(rawMessage => {
                router.handleMessage(senderPhoneNumberId, rawMessage).catch(err => {
                  console.error('handleMessage error:', err?.message);
                  // Última rede: sem isto o cliente fica no silêncio absoluto.
                  // O envio pode falhar junto (se o problema for a própria Graph
                  // API) — nesse caso só resta o log.
                  router.avisarFalhaInesperada(senderPhoneNumberId, rawMessage)
                    .catch(e => console.error('aviso de falha não enviado:', e?.message));
                });
              });
            }
          }
        });
      });
    }

    res.status(200).send("EVENT_RECEIVED");
  });

  // Página institucional — é o que o associado (e o revisor da Meta, que olha o
  // site declarado no perfil do WhatsApp Business) vê ao abrir assusa.tech.
  app.get("/", (_req, res) => {
    res.sendFile(require("path").join(__dirname, "web", "index.html"));
  });

  // Diagnóstico legível por máquina, que antes ficava na raiz. O smoke test do
  // CI procura "Servidor ativo" aqui; os health checks do Dockerfile e do
  // scripts/deploy.sh olham só o código 200 da raiz, então seguem valendo.
  app.get("/status", (_req, res) => {
    res.json({
      message: "Assusa Atendimento WhatsApp - Servidor ativo",
      endpoints: ["POST /webhook - Recebe eventos do WhatsApp"]
    });
  });

  return app;
}

module.exports = { createApp };

if (require.main === module) {
  config.checkEnvVariables();
  const app = createApp();
  var listener = app.listen(config.port, async () => {
    const addr = listener.address();
    console.log(`The app is listening on port ${addr.port}`);
    try {
      const h = await sicoobClient.checkPythonHealth();
      if (!h.skipped) {
        console.log(
          h.ok
            ? "Microsserviço Python (Sicoob): OK"
            : "Microsserviço Python (Sicoob): indisponível",
          h.body || h.error || ""
        );
      }
    } catch (e) {
      console.warn("Health check Python (Sicoob) falhou:", e.message || e);
    }
  });
}
