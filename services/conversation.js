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
const mailer = require('./mailer');


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
    ]
  );
}

async function handleSolicitacaoSegundaVia(
  messageId,
  senderPhoneNumberId,
  recipientPhoneNumber
) {
  await GraphApi.messageWithText(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    constants.MSG_SOLICITAR_CPF_1
  );
  await GraphApi.messageWithText(
    undefined,
    senderPhoneNumberId,
    recipientPhoneNumber,
    constants.MSG_SOLICITAR_CPF_2
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

  await GraphApi.messageWithText(
    message.id,
    senderPhoneNumberId,
    message.senderPhoneNumber,
    constants.MSG_CONSULTANDO_BOLETOS
  );

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
    console.error('[listarBoletos] erro da API Sicoob:', JSON.stringify(resultData));
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
    console.warn('[listarBoletos] resposta vazia da API Sicoob:', JSON.stringify(resultData));
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

  // Ordena pela data de vencimento original (string ISO ordena cronologicamente)
  // do mais antigo para o mais recente e limita a 3.
  const ordenados = [...boletos].sort(
    (a, b) => String(a.dataVencimento).localeCompare(String(b.dataVencimento))
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

  // A listagem (listar) traz vencimento/valor ORIGINAIS; a 2ª via recalcula para
  // pagamento hoje (com juros/multa). Enriquecemos com o valor atualizado para
  // que a listagem e o PDF entregue mostrem o mesmo valor a pagar.
  const enriquecidos = await enriquecerBoletos(exibir);

  interacao.registrar(message.senderPhoneNumber, "BOLETOS_LISTADOS", cpfDigits, { total: boletos.length, exibidos: enriquecidos.length });
  await Cache.setBoletos(message.senderPhoneNumber, enriquecidos);
  await Cache.setEstado(message.senderPhoneNumber, "aguardando_selecao_boleto");

  // Distinguimos cada conta pelo vencimento ORIGINAL (único diferenciador entre
  // boletos), mostrando o valor já atualizado para pagamento hoje.
  const lista = enriquecidos.map((b, i) =>
    constants.MSG_SELECIONAR_BOLETO_ITEM
      .replace("{N}", i + 1)
      .replace("{DATA}", formatarData(b.dataVencimentoOriginal))
      .replace("{VALOR}", formatarBRL(b.valorPagar))
  ).join("\n");

  const botoes = enriquecidos.map((b, i) => ({
    id: `${constants.REPLY_BOLETO_PREFIX}${i}`,
    title: `${i + 1} - Conta ${formatarDataCurta(b.dataVencimentoOriginal)}`
  }));

  await GraphApi.messageWithInteractiveReply(
    message.id,
    senderPhoneNumberId,
    message.senderPhoneNumber,
    constants.MSG_SELECIONAR_BOLETO
      .replace("{TOTAL}", enriquecidos.length)
      .replace("{LISTA}", lista),
    botoes
  );
}

/**
 * Para cada boleto retornado pela listagem, consulta a 2ª via (sem PDF) para
 * obter o valor atualizado e a data de pagamento. Mantém o vencimento ORIGINAL
 * (diferenciador entre boletos) e o valor a pagar (atualizado). Tolerante a
 * falha: se a 2ª via falhar para um item, mantém os valores originais dele.
 */
async function enriquecerBoletos(boletos) {
  const settled = await Promise.allSettled(
    boletos.map(b =>
      sicoobClient.segundaViaBoleto({
        numeroCliente: config.sicoobNumeroCliente,
        codigoModalidade: 1,
        linhaDigitavel: b.linhaDigitavel,
        gerarPdf: false,
      })
    )
  );

  return boletos.map((b, i) => {
    let valorPagar = b.valor;
    let dataVencimentoPagar = b.dataVencimento;
    const r = settled[i];
    if (r.status === "fulfilled") {
      const res = r.value?.body?.ok ? r.value.body.result?.response?.resultado : null;
      if (res) {
        if (res.valor != null) valorPagar = res.valor;
        if (res.dataVencimento) dataVencimentoPagar = res.dataVencimento;
      }
    }
    return {
      linhaDigitavel: b.linhaDigitavel,
      nossoNumero: b.nossoNumero,
      dataVencimentoOriginal: b.dataVencimento,
      dataVencimentoPagar,
      valorPagar,
    };
  });
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
  interacao.registrar(message.senderPhoneNumber, "BOLETO_SELECIONADO", null, { idx, dataVencimento: boleto.dataVencimentoOriginal });
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
    // Mantém a lista para nova tentativa; renova o TTL.
    await refrescarSessaoBoletos(message.senderPhoneNumber, boletos);
    return;
  }

  const recipient = message.senderPhoneNumber;
  const linhaDigitavel = resultado.linhaDigitavel || boleto.linhaDigitavel || "—";
  const caption = constants.MSG_BOLETO_CAPTION
    .replace("{DATA}", formatarData(resultado.dataVencimento))
    .replace("{VALOR}", formatarBRL(resultado.valor));

  // 1) PDF (ou texto, se o upload falhar) com vencimento + valor
  try {
    const pdfBuffer = Buffer.from(resultado.pdfBoleto, "base64");
    const { id: mediaId } = await GraphApi.uploadMedia(senderPhoneNumberId, pdfBuffer);
    await GraphApi.messageWithDocument(
      message.id, senderPhoneNumberId, recipient, mediaId, "boleto.pdf", caption
    );
  } catch {
    await GraphApi.messageWithText(message.id, senderPhoneNumberId, recipient, caption);
  }

  // 2) e 3) linha digitável — rótulo e número em mensagens separadas (cópia fácil)
  await GraphApi.messageWithText(undefined, senderPhoneNumberId, recipient, constants.MSG_LABEL_LINHA_DIGITAVEL);
  await GraphApi.messageWithText(undefined, senderPhoneNumberId, recipient, linhaDigitavel);

  // 4) e 5) PIX copia e cola — rótulo e código em mensagens separadas
  if (resultado.qrCode) {
    await GraphApi.messageWithText(undefined, senderPhoneNumberId, recipient, constants.MSG_LABEL_PIX);
    await GraphApi.messageWithText(undefined, senderPhoneNumberId, recipient, resultado.qrCode);
  } else {
    await GraphApi.messageWithText(undefined, senderPhoneNumberId, recipient, constants.MSG_PIX_INDISPONIVEL);
  }

  interacao.registrar(recipient, "PDF_ENTREGUE", null, { dataVencimento: resultado.dataVencimento, valor: resultado.valor });

  // Mantém estado + boletos para o cliente escolher outra conta sem redigitar o
  // CPF; renova o TTL (janela deslizante).
  await refrescarSessaoBoletos(recipient, boletos);
}

/**
 * Renova o TTL do estado e do cache de boletos, mantendo a lista clicável
 * enquanto o cliente continua interagindo.
 */
async function refrescarSessaoBoletos(phoneNumber, boletos) {
  await Cache.setEstado(phoneNumber, "aguardando_selecao_boleto");
  await Cache.setBoletos(phoneNumber, boletos);
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

    const PALAVRAS_SAIDA = ["menu", "sair", "voltar", "cancelar", "inicio"];
    const normalize = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

    if (message.type === "unknown" && PALAVRAS_SAIDA.includes(normalize(message.text || ""))) {
      await Cache.clearEstado(message.senderPhoneNumber);
      await Cache.clearBoletos(message.senderPhoneNumber);
      interacao.registrar(message.senderPhoneNumber, "FLUXO_CANCELADO");
      await sendMenuPrincipal(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        constants.APP_DEFAULT_MESSAGE
      );
      return;
    }

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
        mailer.notificarAtendente({ telefone: message.senderPhoneNumber });
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
