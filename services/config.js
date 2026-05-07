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
  "SICOOB_CLIENT_ID",
  "SICOOB_CLIENT_SECRET",
  "SICOOB_COOPERATIVA_ID",
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
  sicoobClientId: process.env.SICOOB_CLIENT_ID,
  sicoobClientSecret: process.env.SICOOB_CLIENT_SECRET,
  sicoobCooperativaId: process.env.SICOOB_COOPERATIVA_ID,
  sicoobNumeroCliente: process.env.SICOOB_NUMERO_CLIENTE,

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
