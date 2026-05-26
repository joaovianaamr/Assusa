/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const constants = require("./constants");
const config = require("./config");
const GraphApi = require('./graph-api');
const Message = require('./message');
const Status = require('./status');
const Cache = require('./redis');
const sicoobClient = require('./sicoobClient');
const interacao = require('./interacaoClient');


function sendMenuPrincipal(
  messageId,
  senderPhoneNumberId,
  recipientPhoneNumber,
  messageBody
) {
  return GraphApi.messageWithInteractiveReply(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    messageBody,
    [
      {
        id: constants.REPLY_SEGUNDA_VIA_ID,
        title: constants.REPLY_SEGUNDA_VIA_CTA,
      },
      {
        id: constants.REPLY_FALAR_ATENDENTE_ID,
        title: constants.REPLY_FALAR_ATENDENTE_CTA,
      },
      {
        id: constants.REPLY_HORARIO_ID,
        title: constants.REPLY_HORARIO_CTA,
      }
    ]
  );
}

function handleSolicitacaoSegundaVia(
  messageId,
  senderPhoneNumberId,
  recipientPhoneNumber
) {
  return GraphApi.messageWithText(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    constants.MSG_SOLICITAR_CPF
  );
}

function cpfValido(digits) {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len) => {
    const soma = digits.slice(0, len).split("").reduce(
      (acc, d, i) => acc + Number(d) * (len + 1 - i), 0
    );
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

async function handleCpfRecebido(senderPhoneNumberId, message) {
  const cpfDigits = (message.text || "").replace(/\D/g, "");

  if (cpfDigits.length !== 11 || !cpfValido(cpfDigits)) {
    interacao.registrar(message.senderPhoneNumber, "CPF_INVALIDO", null, { cpf_recebido: cpfDigits });
    await GraphApi.messageWithText(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_SEGUNDA_VIA_ERRO
    );
    return;
  }

  let resultado;
  try {
    resultado = await sicoobClient.listarBoletos({ numeroCpfCnpj: cpfDigits });
  } catch {
    interacao.registrar(message.senderPhoneNumber, "ERRO_SERVICO", cpfDigits, { etapa: "listar_boletos" });
    await GraphApi.messageWithText(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_SEGUNDA_VIA_ERRO_SERVICO
    );
    await Cache.clearEstado(message.senderPhoneNumber);
    return;
  }

  const resultData = resultado.body?.result;
  const hasServiceError =
    resultData?.error ||
    (resultData?.status_code != null && resultData.status_code >= 400);

  if (hasServiceError) {
    interacao.registrar(message.senderPhoneNumber, "ERRO_SERVICO", cpfDigits, { etapa: "listar_boletos", detail: resultData });
    await GraphApi.messageWithText(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_SEGUNDA_VIA_ERRO_SERVICO
    );
    await Cache.clearEstado(message.senderPhoneNumber);
    return;
  }

  const raw = resultData?.response;
  const boletos = Array.isArray(raw) ? raw
    : Array.isArray(raw?.resultado) ? raw.resultado
    : [];

  if (!boletos.length) {
    interacao.registrar(message.senderPhoneNumber, "NENHUM_BOLETO", cpfDigits);
    await GraphApi.messageWithText(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_NENHUM_BOLETO
    );
    await Cache.clearEstado(message.senderPhoneNumber);
    return;
  }

  // Ordena do mais antigo para o mais recente e limita a 3
  const ordenados = [...boletos].sort(
    (a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento)
  );
  const exibir = ordenados.slice(0, 3);

  // Avisa se há mais de 3
  if (boletos.length > 3) {
    await GraphApi.messageWithText(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_AVISO_MUITOS_BOLETOS.replace("{TOTAL}", boletos.length)
    );
  }

  interacao.registrar(message.senderPhoneNumber, "BOLETOS_LISTADOS", cpfDigits, { total: boletos.length, exibidos: exibir.length });
  await Cache.setBoletos(message.senderPhoneNumber, exibir);
  await Cache.setEstado(message.senderPhoneNumber, "aguardando_selecao_boleto");

  const botoes = exibir.map((b, i) => ({
    id: `${constants.REPLY_BOLETO_PREFIX}${i}`,
    title: `Venc. ${b.dataVencimento}`
  }));

  await GraphApi.messageWithInteractiveReply(
    message.id,
    senderPhoneNumberId,
    message.senderPhoneNumber,
    constants.MSG_SELECIONAR_BOLETO.replace("{TOTAL}", boletos.length),
    botoes
  );
}

async function handleSelecaoBoleto(senderPhoneNumberId, message) {
  const idx = parseInt(
    message.type.replace(constants.REPLY_BOLETO_PREFIX, ""),
    10
  );
  const boletos = await Cache.getBoletos(message.senderPhoneNumber);

  if (!boletos || isNaN(idx) || !boletos[idx]) {
    await GraphApi.messageWithText(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_SEGUNDA_VIA_ERRO_SERVICO
    );
    await Cache.clearEstado(message.senderPhoneNumber);
    await Cache.clearBoletos(message.senderPhoneNumber);
    return;
  }

  const boleto = boletos[idx];
  interacao.registrar(message.senderPhoneNumber, "BOLETO_SELECIONADO", null, { idx, dataVencimento: boleto.dataVencimento });
  let resultado;
  try {
    const res = await sicoobClient.segundaViaBoleto({
      numeroCliente: config.sicoobNumeroCliente,
      codigoModalidade: 1,
      linhaDigitavel: boleto.linhaDigitavel,
    });
    resultado = res.body?.ok ? res.body.result?.response?.resultado : null;
  } catch {
    resultado = null;
  }

  if (!resultado?.pdfBoleto) {
    interacao.registrar(message.senderPhoneNumber, "ERRO_SERVICO", null, { etapa: "segunda_via" });
    await GraphApi.messageWithText(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_SEGUNDA_VIA_ERRO_SERVICO
    );
  } else {
    const caption = constants.MSG_BOLETO_DETALHES
      .replace("{DATA}", resultado.dataVencimento ?? "—")
      .replace("{VALOR}", resultado.valor ?? "—")
      .replace("{LINHA_DIGITAVEL}", resultado.linhaDigitavel ?? "—")
      .replace("{QR_CODE}", resultado.qrCode ?? "—");

    try {
      const pdfBuffer = Buffer.from(resultado.pdfBoleto, "base64");
      const { id: mediaId } = await GraphApi.uploadMedia(senderPhoneNumberId, pdfBuffer);
      await GraphApi.messageWithDocument(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        mediaId,
        "boleto.pdf",
        caption
      );
      interacao.registrar(message.senderPhoneNumber, "PDF_ENTREGUE", null, { dataVencimento: resultado.dataVencimento, valor: resultado.valor });
    } catch {
      // upload falhou — envia só o texto como fallback
      await GraphApi.messageWithText(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        caption
      );
    }
  }

  await Cache.clearEstado(message.senderPhoneNumber);
  await Cache.clearBoletos(message.senderPhoneNumber);
}

async function markMessageForFollowUp(messageId) {
  await Cache.insert(messageId);
}


module.exports = class Conversation {
  constructor(phoneNumberId) {
    this.phoneNumberId = phoneNumberId;
  }

  static async handleMessage(senderPhoneNumberId, rawMessage) {
    const message = new Message(rawMessage);
    const estadoAtual = await Cache.getEstado(message.senderPhoneNumber);

    const MENU_BUTTONS = [
      constants.REPLY_SEGUNDA_VIA_ID,
      constants.REPLY_FALAR_ATENDENTE_ID,
      constants.REPLY_HORARIO_ID,
    ];

    if (estadoAtual === "aguardando_cpf") {
      if (!MENU_BUTTONS.includes(message.type)) {
        await handleCpfRecebido(senderPhoneNumberId, message);
        return;
      }
      await Cache.clearEstado(message.senderPhoneNumber);
    }

    if (estadoAtual === "aguardando_selecao_boleto") {
      if (!MENU_BUTTONS.includes(message.type)) {
        await handleSelecaoBoleto(senderPhoneNumberId, message);
        return;
      }
      await Cache.clearEstado(message.senderPhoneNumber);
      await Cache.clearBoletos(message.senderPhoneNumber);
    }

    switch (message.type) {
      case constants.REPLY_SEGUNDA_VIA_ID:
        interacao.registrar(message.senderPhoneNumber, "SEGUNDA_VIA_INICIADA");
        await Cache.setEstado(message.senderPhoneNumber, "aguardando_cpf");
        await handleSolicitacaoSegundaVia(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber
        );
        break;
      case constants.REPLY_FALAR_ATENDENTE_ID:
        interacao.registrar(message.senderPhoneNumber, "ATENDENTE_SOLICITADO");
        await GraphApi.messageWithText(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          constants.MSG_REDIRECIONAMENTO_ATENDENTE
        );
        break;
      case constants.REPLY_HORARIO_ID:
        interacao.registrar(message.senderPhoneNumber, "HORARIO_CONSULTADO");
        await GraphApi.messageWithText(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          constants.MSG_HORARIO_FUNCIONAMENTO
        );
        break;
      default:
        interacao.registrar(message.senderPhoneNumber, "MENU_EXIBIDO");
        await sendMenuPrincipal(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          constants.APP_DEFAULT_MESSAGE
        );
        break;
    }
  }

  static async handleStatus(senderPhoneNumberId, rawStatus) {
    const status = new Status(rawStatus);

    // Only handle delivered and read statuses
    if (!(status.status === 'delivered' || status.status === 'read')) {
      return;
    }

    // Only send a follow up message if the current message is flagged
    // as needing one in the cache.
    if (await Cache.remove(status.messageId)) {
      await sendMenuPrincipal(
        undefined,
        senderPhoneNumberId,
        status.recipientPhoneNumber,
        constants.APP_TRY_ANOTHER_MESSAGE
      );
    }
  }
};
