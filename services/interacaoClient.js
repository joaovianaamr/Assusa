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

function registrar(telefone, evento, cpf = null, detalhes = null) {
  const b = baseUrl();
  if (!b) return;
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
