/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();

// Required environment variables (webhook verify token checked separately:
// WHATSAPP_VERIFY_TOKEN or legacy VERIFY_TOKEN)
const ENV_VARS = [
  "ACCESS_TOKEN",
  "APP_SECRET",
  "REDIS_HOST",
  "REDIS_PORT",
  "SICOOB_NUMERO_CLIENTE"
];

module.exports = Object.freeze({
  // Application information
  appSecret: process.env.APP_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  verifyToken:
    process.env.WHATSAPP_VERIFY_TOKEN || process.env.VERIFY_TOKEN,

  // Server configuration
  port: process.env.PORT || 8080,
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: process.env.REDIS_PORT || 6379,
  sicoobNumeroCliente: process.env.SICOOB_NUMERO_CLIENTE,

  // Janela em que a lista de boletos permanece clicável (sliding TTL no Redis)
  estadoTtlSeconds: Number(process.env.ESTADO_TTL_SECONDS) || 1800,

  // Notificação de atendente por e-mail (SMTP)
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM,
  atendenteEmailTo: process.env.ATENDENTE_EMAIL_TO,

  checkEnvVariables: function () {
    ENV_VARS.forEach(function (key) {
      if (!process.env[key]) {
        console.warn("WARNING: Missing the environment variable " + key);
      }
    });
    if (!process.env.WHATSAPP_VERIFY_TOKEN && !process.env.VERIFY_TOKEN) {
      console.warn(
        "WARNING: Missing WHATSAPP_VERIFY_TOKEN (or legacy VERIFY_TOKEN) for webhook URL verification"
      );
    }
  }
});
