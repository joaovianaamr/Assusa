/**
 * Formatação e montagem das mensagens de listagem de boletos.
 *
 * Este módulo é deliberadamente puro (sem Redis, sem rede): `conversation.js`
 * conecta ao Redis como efeito colateral de módulo, então nada lá dentro pode
 * ser testado com `require`. Tudo que dá para testar isolado mora aqui.
 */

"use strict";

const mensagens = require("./mensagens");

// Limites da Meta (WhatsApp Cloud API) para mensagens interativas.
const MAX_BOTOES = 3;          // mensagem de botões
const MAX_ROWS = 10;           // linhas de uma lista interativa
const LIMITE_TITULO_BOTAO = 20;
const LIMITE_TITULO_ROW = 24;
const LIMITE_DESCRICAO_ROW = 72;
const LIMITE_CORPO = 1024;     // corpo de qualquer mensagem interativa

// Quantas contas exibimos no máximo — vem do teto de linhas da lista.
const MAX_BOLETOS_EXIBIDOS = MAX_ROWS;

function truncar(texto, limite) {
  const s = String(texto ?? "");
  return s.length <= limite ? s : s.slice(0, limite);
}

function formatarData(iso) {
  if (!iso || typeof iso !== "string") return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatarDataCurta(iso) {
  if (!iso || typeof iso !== "string") return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function formatarBRL(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return "—";
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Acima de 3 contas os botões não cabem — cai para a lista interativa. */
function deveUsarLista(quantidade) {
  return quantidade > MAX_BOTOES;
}

/** Texto enumerado das contas, usado no corpo da mensagem nos dois formatos. */
function montarLinhasBoletos(boletos) {
  return boletos.map((b, i) =>
    mensagens.MSG_SELECIONAR_BOLETO_ITEM
      .replace("{N}", i + 1)
      .replace("{DATA}", formatarData(b.dataVencimentoOriginal))
      .replace("{VALOR}", formatarBRL(b.valorPagar))
  ).join("\n");
}

/**
 * Botões de resposta (até 3). O id repete o de `montarRowsLista`, para que
 * `handleSelecaoBoleto` trate clique de botão e de lista do mesmo jeito.
 */
function montarBotoesBoletos(boletos) {
  return boletos.slice(0, MAX_BOTOES).map((b, i) => ({
    id: `${mensagens.REPLY_BOLETO_PREFIX}${i}`,
    title: truncar(
      `${i + 1} - Conta ${formatarDataCurta(b.dataVencimentoOriginal)}`,
      LIMITE_TITULO_BOTAO
    )
  }));
}

/**
 * Monta o corpo da mensagem de escolha. Com 10 contas o texto fica em torno de
 * 600 caracteres; o corte em 1024 é só uma salvaguarda para a Meta não recusar
 * a mensagem inteira (erro 400) caso os textos cresçam.
 */
function montarCorpoSelecao(template, boletos) {
  return truncar(
    template
      .replace("{TOTAL}", boletos.length)
      .replace("{LISTA}", montarLinhasBoletos(boletos)),
    LIMITE_CORPO
  );
}

/** Linhas da lista interativa (até 10), com valor atualizado na descrição. */
function montarRowsLista(boletos) {
  return boletos.slice(0, MAX_ROWS).map((b, i) => ({
    id: `${mensagens.REPLY_BOLETO_PREFIX}${i}`,
    title: truncar(
      `${i + 1}) Conta ${formatarData(b.dataVencimentoOriginal)}`,
      LIMITE_TITULO_ROW
    ),
    description: truncar(
      mensagens.MSG_LISTA_ITEM_DESCRICAO.replace("{VALOR}", formatarBRL(b.valorPagar)),
      LIMITE_DESCRICAO_ROW
    )
  }));
}

/**
 * Linhas da lista de facilidades exibida depois de entregar o PDF.
 *
 * A ordem importa: o que o cliente veio buscar (o código para pagar) vem
 * primeiro; sair da conversa é a última linha. A linha do PIX some quando o
 * boleto não tem QR Code — oferecer e depois dizer "indisponível" seria pior
 * do que não oferecer.
 *
 * @param {{temPix:boolean, restantes:number}} opcoes
 */
function montarRowsFacilidades({ temPix, restantes }) {
  const rows = [
    {
      id: mensagens.REPLY_LINHA_ID,
      title: truncar(mensagens.REPLY_LINHA_CTA, LIMITE_TITULO_ROW),
      description: truncar(mensagens.MSG_FACILIDADE_LINHA_DESC, LIMITE_DESCRICAO_ROW),
    },
  ];

  if (temPix) {
    rows.push({
      id: mensagens.REPLY_PIX_ID,
      title: truncar(mensagens.REPLY_PIX_CTA, LIMITE_TITULO_ROW),
      description: truncar(mensagens.MSG_FACILIDADE_PIX_DESC, LIMITE_DESCRICAO_ROW),
    });
  }

  if (restantes > 0) {
    rows.push({
      id: mensagens.REPLY_VER_OUTRAS_ID,
      title: truncar(mensagens.REPLY_VER_OUTRAS_CTA, LIMITE_TITULO_ROW),
      description: truncar(
        mensagens.MSG_FACILIDADE_OUTRAS_DESC.replace("{RESTANTES}", restantes),
        LIMITE_DESCRICAO_ROW
      ),
    });
  }

  rows.push({
    id: mensagens.REPLY_MENU_ID,
    title: truncar(mensagens.REPLY_MENU_CTA, LIMITE_TITULO_ROW),
    description: truncar(mensagens.MSG_FACILIDADE_MENU_DESC, LIMITE_DESCRICAO_ROW),
  });

  return rows;
}

/**
 * Descobre qual conta o cliente escolheu. Aceita as três formas de resposta:
 * clique de botão e toque em item de lista (ambos chegam como id "boleto-N"),
 * e o número digitado — usado no fallback em texto, mas aceito sempre, porque
 * parte do público tem dificuldade em achar o botão.
 *
 * @returns {number|null} índice 0-based, ou null se não der para resolver.
 */
function resolverIndiceSelecao({ type, text }, total) {
  const dentroDoIntervalo = i => Number.isInteger(i) && i >= 0 && i < total;

  if (typeof type === "string" && type.startsWith(mensagens.REPLY_BOLETO_PREFIX)) {
    const i = parseInt(type.slice(mensagens.REPLY_BOLETO_PREFIX.length), 10);
    return dentroDoIntervalo(i) ? i : null;
  }

  // Número digitado: o cliente conta a partir de 1.
  const digitado = String(text ?? "").trim();
  if (/^\d{1,2}$/.test(digitado)) {
    const i = Number(digitado) - 1;
    return dentroDoIntervalo(i) ? i : null;
  }

  return null;
}

module.exports = {
  MAX_BOTOES,
  MAX_ROWS,
  MAX_BOLETOS_EXIBIDOS,
  LIMITE_TITULO_BOTAO,
  LIMITE_TITULO_ROW,
  LIMITE_DESCRICAO_ROW,
  LIMITE_CORPO,
  truncar,
  montarCorpoSelecao,
  resolverIndiceSelecao,
  formatarData,
  formatarDataCurta,
  formatarBRL,
  deveUsarLista,
  montarLinhasBoletos,
  montarBotoesBoletos,
  montarRowsLista,
  montarRowsFacilidades,
};
