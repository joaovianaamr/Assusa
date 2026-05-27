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

const NUM_JANELAS = Number(process.env.SICOOB_NUM_JANELAS || 6);
const DIAS_POR_JANELA = 30;

async function chamarListarUmaJanela(payload) {
  const b = baseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${b}/internal/boleto/listar`, {
      method: "POST",
      headers: internalHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let body = {};
    try { body = await res.json(); } catch { body = {}; }
    return { status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function extrairBoletos(resposta) {
  const data = resposta?.body?.result;
  if (!data || data.error || (data.status_code != null && data.status_code >= 400)) {
    return null;
  }
  const raw = data.response;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.resultado)) return raw.resultado;
  return [];
}

/**
 * POST /internal/boleto/listar — busca em janelas paralelas.
 *
 * O Sicoob limita cada requisição a 35 dias. Para cobrir 6 meses
 * (inadimplência típica antes do corte de fornecimento da Assusa),
 * dispara NUM_JANELAS chamadas de 30 dias em paralelo com gap de 1 dia
 * entre elas. Janelas individuais que falharem são ignoradas; retorna
 * 503 apenas se TODAS falharem.
 */
async function listarBoletos({ numeroCpfCnpj }) {
  const b = baseUrl();
  if (!b) {
    throw new Error("SICOOB_SERVICE_URL não configurado");
  }

  const fmt = d => d.toISOString().slice(0, 10);
  const hoje = new Date();

  const janelas = Array.from({ length: NUM_JANELAS }, (_, i) => {
    const fim = new Date(hoje);
    fim.setDate(fim.getDate() - i * (DIAS_POR_JANELA + 1));
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - DIAS_POR_JANELA);
    return {
      numeroCpfCnpj,
      numeroCliente: Number(config.sicoobNumeroCliente),
      dataInicio: fmt(inicio),
      dataFim: fmt(fim),
      codigoSituacao: 1,
    };
  });

  const respostas = await Promise.allSettled(janelas.map(j => chamarListarUmaJanela(j)));

  const boletosTodos = [];
  let janelasFalhadas = 0;

  for (const [i, r] of respostas.entries()) {
    if (r.status === "rejected") {
      janelasFalhadas++;
      console.warn(`[listarBoletos] Janela ${i} (${janelas[i].dataInicio}→${janelas[i].dataFim}) falhou:`, r.reason?.message || r.reason);
      continue;
    }
    const lista = extrairBoletos(r.value);
    if (lista === null) {
      janelasFalhadas++;
      console.warn(`[listarBoletos] Janela ${i} retornou erro de serviço:`, r.value?.body?.result);
      continue;
    }
    boletosTodos.push(...lista);
  }

  if (janelasFalhadas === NUM_JANELAS) {
    return {
      status: 503,
      body: { ok: false, result: { error: "Todas as janelas de busca falharam" } },
    };
  }

  const unicos = new Map();
  for (const boleto of boletosTodos) {
    const chave = boleto.linhaDigitavel || `nn:${boleto.nossoNumero}`;
    if (!unicos.has(chave)) unicos.set(chave, boleto);
  }
  const lista = [...unicos.values()];

  console.log(
    `[listarBoletos] CPF=${numeroCpfCnpj} ` +
    `janelas_ok=${NUM_JANELAS - janelasFalhadas}/${NUM_JANELAS} ` +
    `total_bruto=${boletosTodos.length} unicos=${lista.length}`
  );

  return {
    status: 200,
    body: { ok: true, result: { response: { resultado: lista } } },
  };
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
