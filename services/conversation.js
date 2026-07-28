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
const view = require('./boletoView');

const { formatarData, formatarBRL } = view;

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
    ]
  );
}

/**
 * Envia uma mensagem de fim de fluxo (erro, CPF não encontrado, cliente em dia)
 * acompanhada de um botão que volta ao menu principal.
 *
 * Sem o botão o cliente precisava *digitar* "menu" para recomeçar — barreira real
 * para o público idoso, que é a maior parte de quem usa o bot.
 *
 * Mesma proteção do envio da listagem: se a Meta recusar o interativo, o texto
 * ainda sai. As palavras-chave de saída seguem valendo nos dois casos.
 */
async function enviarComBotaoMenu(messageId, senderPhoneNumberId, recipientPhoneNumber, texto) {
  try {
    await GraphApi.messageWithInteractiveReply(
      messageId,
      senderPhoneNumberId,
      recipientPhoneNumber,
      texto,
      [{ id: constants.REPLY_MENU_ID, title: constants.REPLY_MENU_CTA }]
    );
    return;
  } catch (e) {
    console.error('[menu] botão de retorno não pôde ser enviado, caindo para texto:', e?.message || e);
  }
  await GraphApi.messageWithText(messageId, senderPhoneNumberId, recipientPhoneNumber, texto);
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
    await enviarComBotaoMenu(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_CPF_INVALIDO
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
    await enviarComBotaoMenu(
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
    await enviarComBotaoMenu(
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
    await responderSemBoletosEmAberto(senderPhoneNumberId, message, cpfDigits);
    await Cache.clearEstado(message.senderPhoneNumber);
    return;
  }

  await apresentarBoletos(senderPhoneNumberId, message, cpfDigits, boletos);
}

/**
 * A busca por contas EM ABERTO voltou vazia. Isso acontece em dois casos muito
 * diferentes para o cliente — ele está em dia, ou o CPF não é do titular — e a
 * consulta filtrada não os distingue. Refazemos sem o filtro de situação: se
 * houver qualquer boleto no histórico, o CPF é de cliente.
 *
 * Se essa segunda consulta falhar, usamos o texto genérico: nunca afirmamos
 * "esse CPF não existe" com base em uma consulta que caiu.
 */
async function responderSemBoletosEmAberto(senderPhoneNumberId, message, cpfDigits) {
  let mensagem = constants.MSG_NENHUM_BOLETO;
  let evento = "NENHUM_BOLETO";

  try {
    const historico = await sicoobClient.listarBoletos({
      numeroCpfCnpj: cpfDigits,
      codigoSituacao: null,
    });
    const dados = historico.body?.result;
    const falhou =
      dados?.error || (dados?.status_code != null && dados.status_code >= 400);

    if (!falhou) {
      const raw = dados?.response;
      const lista = Array.isArray(raw) ? raw
        : Array.isArray(raw?.resultado) ? raw.resultado
        : [];
      if (lista.length) {
        mensagem = constants.MSG_CLIENTE_EM_DIA.replace("{CPF}", view.mascararCpf(cpfDigits));
        evento = "CLIENTE_EM_DIA";
      } else {
        mensagem = constants.MSG_CPF_NAO_ENCONTRADO;
        evento = "CPF_NAO_ENCONTRADO";
      }
    }
  } catch (e) {
    console.warn('[historico] consulta sem filtro de situação falhou:', e?.message || e);
  }

  interacao.registrar(message.senderPhoneNumber, evento, cpfDigits);
  await enviarComBotaoMenu(
    message.id,
    senderPhoneNumberId,
    message.senderPhoneNumber,
    mensagem
  );
}

/**
 * Ordena da conta mais antiga para a mais recente, corta no teto exibível,
 * atualiza os valores e entrega em botões (até 3 contas) ou lista interativa
 * (4 ou mais) — o limite de 3 é da mensagem de botões da Meta, não do negócio.
 */
async function apresentarBoletos(senderPhoneNumberId, message, cpfDigits, boletos) {
  const ordenados = [...boletos].sort(
    (a, b) => String(a.dataVencimento).localeCompare(String(b.dataVencimento))
  );
  const exibir = ordenados.slice(0, view.MAX_BOLETOS_EXIBIDOS);

  if (boletos.length > exibir.length) {
    await GraphApi.messageWithText(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_AVISO_MUITOS_BOLETOS
        .replace("{TOTAL}", boletos.length)
        .replace("{EXIBIDOS}", exibir.length)
  );
  }

  // A listagem (listar) traz vencimento/valor ORIGINAIS; a 2ª via recalcula para
  // pagamento hoje (com juros/multa). Enriquecemos com o valor atualizado para
  // que a listagem e o PDF entregue mostrem o mesmo valor a pagar.
  const enriquecidos = await enriquecerBoletos(exibir);

  interacao.registrar(message.senderPhoneNumber, "BOLETOS_LISTADOS", cpfDigits, { total: boletos.length, exibidos: enriquecidos.length });

  // Distinguimos cada conta pelo vencimento ORIGINAL (único diferenciador entre
  // boletos), mostrando o valor já atualizado para pagamento hoje. O corpo
  // enumerado vai em todos os formatos: assim o cliente lê todas as contas sem
  // precisar abrir o menu da lista.
  const usarLista = view.deveUsarLista(enriquecidos.length);

  // O estado só é gravado depois que o cliente REALMENTE recebeu a lista — caso
  // contrário uma recusa da Meta o deixaria preso em aguardando_selecao_boleto
  // sem nunca ter visto as opções.
  const enviou = await enviarSelecaoBoletos(
    senderPhoneNumberId, message, enriquecidos, usarLista
  );
  if (!enviou) {
    await Cache.clearEstado(message.senderPhoneNumber);
    await Cache.clearBoletos(message.senderPhoneNumber);
    return;
  }

  await Cache.setBoletos(message.senderPhoneNumber, enriquecidos);
  await Cache.setEstado(message.senderPhoneNumber, "aguardando_selecao_boleto");
}

/**
 * Envia a lista de contas, com queda em cascata: interativo → texto simples.
 *
 * A Meta recusa a mensagem inteira (HTTP 400) por detalhes de formato — título
 * acima do limite, corpo grande, payload malformado. Sem esta rede, o cliente
 * recebia "Aguarde, estou consultando..." e depois silêncio. No fallback ele
 * escolhe respondendo o número da conta (ver `view.resolverIndiceSelecao`).
 *
 * @returns {Promise<boolean>} true se alguma das formas chegou ao cliente.
 */
async function enviarSelecaoBoletos(senderPhoneNumberId, message, boletos, usarLista) {
  const recipient = message.senderPhoneNumber;

  try {
    const corpo = view.montarCorpoSelecao(
      usarLista ? constants.MSG_SELECIONAR_BOLETO_LISTA : constants.MSG_SELECIONAR_BOLETO,
      boletos
    );

    if (usarLista) {
      await GraphApi.messageWithInteractiveList(
        message.id, senderPhoneNumberId, recipient, corpo,
        constants.MSG_LISTA_BOTAO, constants.MSG_LISTA_SECAO,
        view.montarRowsLista(boletos)
      );
    } else {
      await GraphApi.messageWithInteractiveReply(
        message.id, senderPhoneNumberId, recipient, corpo,
        view.montarBotoesBoletos(boletos)
      );
    }
    return true;
  } catch (e) {
    console.error('[selecao] envio interativo falhou, caindo para texto:', e?.message || e);
  }

  try {
    await GraphApi.messageWithText(
      message.id,
      senderPhoneNumberId,
      recipient,
      view.montarCorpoSelecao(constants.MSG_SELECIONAR_BOLETO_TEXTO, boletos)
    );
    interacao.registrar(recipient, "SELECAO_FALLBACK_TEXTO", null, { exibidos: boletos.length });
    return true;
  } catch (e) {
    console.error('[selecao] fallback em texto também falhou:', e?.message || e);
    return false;
  }
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
  const boletos = await Cache.getBoletos(message.senderPhoneNumber);
  // Aceita clique de botão, toque em item de lista e número digitado.
  const idx = boletos ? view.resolverIndiceSelecao(message, boletos.length) : null;

  // Cache expirado ou perdido: não há mais o que escolher, volta ao início.
  if (!boletos || !boletos.length) {
    await enviarComBotaoMenu(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_SEGUNDA_VIA_ERRO_SERVICO
    );
    await Cache.clearEstado(message.senderPhoneNumber);
    await Cache.clearBoletos(message.senderPhoneNumber);
    return;
  }

  // A lista existe, mas não deu para entender a resposta (texto solto, número
  // fora do intervalo). Pede de novo em vez de fingir falha de sistema, e
  // mantém a sessão viva para o cliente tentar outra vez.
  if (idx === null || !boletos[idx]) {
    await enviarComBotaoMenu(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_SELECAO_NAO_ENTENDIDA.replace("{TOTAL}", boletos.length)
    );
    await refrescarSessaoBoletos(message.senderPhoneNumber, boletos);
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
    await enviarComBotaoMenu(
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
  await fecharEntrega(senderPhoneNumberId, message, boleto, boletos.length);
}

/**
 * Fecha o atendimento depois de entregar o boleto.
 *
 * Antes a conversa morria no PIX: o cliente não sabia que a lista continuava
 * viva por 30 min e que podia pedir outra conta sem redigitar o CPF.
 *
 * "Ver outras contas" reexibe a lista do Redis — de propósito NÃO está em
 * MENU_BUTTONS, senão limparia a sessão que ele acabou de usar. "Voltar ao
 * menu" continua sendo a saída que descarta tudo.
 */
async function fecharEntrega(senderPhoneNumberId, message, boletoEntregue, totalNaSessao) {
  const temOutras = totalNaSessao > 1;
  const texto = (temOutras ? constants.MSG_POS_ENTREGA_OUTRAS : constants.MSG_POS_ENTREGA_UNICA)
    .replace("{DATA}", formatarData(boletoEntregue.dataVencimentoOriginal))
    .replace("{RESTANTES}", totalNaSessao - 1);

  const botoes = [];
  if (temOutras) {
    botoes.push({ id: constants.REPLY_VER_OUTRAS_ID, title: constants.REPLY_VER_OUTRAS_CTA });
  }
  botoes.push({ id: constants.REPLY_MENU_ID, title: constants.REPLY_MENU_CTA });

  try {
    await GraphApi.messageWithInteractiveReply(
      undefined, senderPhoneNumberId, message.senderPhoneNumber, texto, botoes
    );
  } catch (e) {
    // O boleto já foi entregue; o fechamento não pode derrubar o fluxo.
    console.error('[pos-entrega] botões não enviados, caindo para texto:', e?.message || e);
    await GraphApi.messageWithText(
      undefined, senderPhoneNumberId, message.senderPhoneNumber, texto
    ).catch(err => console.error('[pos-entrega] texto também falhou:', err?.message || err));
  }
}

/**
 * Reexibe a lista guardada no Redis, sem consultar o Sicoob de novo: em até
 * 30 min os valores não mudam de forma perceptível, e assim o cliente não
 * espera nem gasta requisição (o endpoint de pagadores limita a 10/s).
 */
async function reexibirBoletos(senderPhoneNumberId, message) {
  const boletos = await Cache.getBoletos(message.senderPhoneNumber);

  if (!boletos || !boletos.length) {
    interacao.registrar(message.senderPhoneNumber, "SESSAO_EXPIRADA");
    await enviarComBotaoMenu(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.MSG_SESSAO_EXPIRADA
    );
    await Cache.clearEstado(message.senderPhoneNumber);
    return;
  }

  interacao.registrar(message.senderPhoneNumber, "LISTA_REEXIBIDA", null, { total: boletos.length });
  const enviou = await enviarSelecaoBoletos(
    senderPhoneNumberId, message, boletos, view.deveUsarLista(boletos.length)
  );
  if (enviou) {
    await refrescarSessaoBoletos(message.senderPhoneNumber, boletos);
  }
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

    // Botões que valem como "voltar ao início": chegando um deles em qualquer
    // estado, a sessão é descartada antes do dispatch.
    const MENU_BUTTONS = [
      constants.REPLY_SEGUNDA_VIA_ID,
      constants.REPLY_HORARIO_ID,
      constants.REPLY_MENU_ID,
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

    // "Ver outras contas" vale em qualquer estado e é tratado antes da máquina
    // de estados: dentro de aguardando_selecao_boleto ele cairia em
    // handleSelecaoBoleto e viraria "não entendi sua resposta".
    if (message.type === constants.REPLY_VER_OUTRAS_ID) {
      await reexibirBoletos(senderPhoneNumberId, message);
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
      case constants.REPLY_HORARIO_ID:
        interacao.registrar(message.senderPhoneNumber, "HORARIO_CONSULTADO");
        await GraphApi.messageWithText(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          constants.MSG_HORARIO_FUNCIONAMENTO
        );
        break;
      // Botão "Voltar ao menu" oferecido nas mensagens de fim de fluxo. Cairia no
      // default de qualquer forma; o case existe para medir quanto ele é usado.
      case constants.REPLY_MENU_ID:
        interacao.registrar(message.senderPhoneNumber, "MENU_VIA_BOTAO");
        await sendMenuPrincipal(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          constants.APP_DEFAULT_MESSAGE
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

  /**
   * Avisa o cliente quando `handleMessage` estourou de um jeito não previsto.
   * Chamado pelo `.catch` do webhook em `app.js` — o cliente não pode ficar
   * esperando uma resposta que nunca vem.
   */
  static async avisarFalhaInesperada(senderPhoneNumberId, rawMessage) {
    const recipient = rawMessage?.from;
    if (!recipient) return;
    await enviarComBotaoMenu(
      undefined,
      senderPhoneNumberId,
      recipient,
      constants.MSG_ERRO_INESPERADO
  );
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
