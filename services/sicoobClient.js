/**
 * Cliente HTTP para o microsserviço Python (boletos Sicoob).
 * Requer SICOOB_SERVICE_URL e INTERNAL_API_KEY alinhados com o FastAPI.
 */

"use strict";

const config = require("./config");
const DEFAULT_TIMEOUT_MS = 60000;

function baseUrl() {
  const u = process.env.SICOOB_SERVICE_URL;
  if (!u || !String(u).trim()) {
    return null;
  }
  return String(u).replace(/\/$/, "");
}

function internalHeaders() {
  const key = process.env.INTERNAL_API_KEY;
  const headers = { "Content-Type": "application/json" };
  if (key) {
    headers["X-Internal-Api-Key"] = key;
  }
  return headers;
}

/**
 * GET /health no serviço Python (não exige API key).
 * @returns {Promise<{skipped?:boolean,ok?:boolean,status?:number,body?:object,error?:string}>}
 */
async function checkPythonHealth() {
  const b = baseUrl();
  if (!b) {
    return { skipped: true };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${b}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

/**
 * POST /internal/boleto/listar
 * @param {{ numeroCpfCnpj: string, numeroCliente?: string, dataInicio?: string, dataFim?: string }} payload
 * @returns {Promise<{status:number, body: object}>}
 */
async function listarBoletos({ numeroCpfCnpj }) {
  const b = baseUrl();
  if (!b) {
    throw new Error("SICOOB_SERVICE_URL não configurado");
  }

  const hoje = new Date();
  const trintaECincoDiasAtras = new Date(hoje);
  trintaECincoDiasAtras.setDate(hoje.getDate() - 35);
  const fmt = d => d.toISOString().slice(0, 10);

  const payload = {
    numeroCpfCnpj,
    numeroCliente: Number(config.sicoobNumeroCliente),
    dataInicio: fmt(trintaECincoDiasAtras),
    dataFim: fmt(hoje),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${b}/internal/boleto/listar`, {
      method: "POST",
      headers: internalHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * POST /internal/boleto/segunda-via
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{status:number, body: object}>}
 */
async function segundaViaBoleto(payload) {
  const b = baseUrl();
  if (!b) {
    throw new Error("SICOOB_SERVICE_URL não configurado");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${b}/internal/boleto/segunda-via`, {
      method: "POST",
      headers: internalHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  baseUrl,
  checkPythonHealth,
  listarBoletos,
  segundaViaBoleto,
};
