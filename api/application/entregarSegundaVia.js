/**
 * Entregar o PDF da 2ª via e fechar o atendimento.
 *
 * Camada application: orquestra o caso de uso falando com as PORTAS
 * (api/domain/portas), nunca com adapters concretos. Quem liga porta e adapter
 * é o composition root.
 */

"use strict";

module.exports = function criar({ notificador, sessao, bancoBoletos, telemetria, mensagens, view, config, mensageria }) {
  const { formatarData, formatarBRL } = view;
  async function handleSelecaoBoleto(senderPhoneNumberId, message) {
    const boletos = await sessao.getBoletos(message.senderPhoneNumber);
    // Aceita clique de botão, toque em item de lista e número digitado.
    const idx = boletos ? view.resolverIndiceSelecao(message, boletos.length) : null;

    // Cache expirado ou perdido: não há mais o que escolher, volta ao início.
    if (!boletos || !boletos.length) {
      await mensageria.enviarComBotaoMenu(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        mensagens.MSG_SEGUNDA_VIA_ERRO_SERVICO
      );
      await sessao.clearEstado(message.senderPhoneNumber);
      await sessao.clearBoletos(message.senderPhoneNumber);
      return;
    }

    // A lista existe, mas não deu para entender a resposta (texto solto, número
    // fora do intervalo). Pede de novo em vez de fingir falha de sistema, e
    // mantém a sessão viva para o cliente tentar outra vez.
    if (idx === null || !boletos[idx]) {
      await mensageria.enviarComBotaoMenu(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        mensagens.MSG_SELECAO_NAO_ENTENDIDA.replace("{TOTAL}", boletos.length)
      );
      await mensageria.refrescarSessaoBoletos(message.senderPhoneNumber, boletos);
      return;
    }

    const boleto = boletos[idx];
    telemetria.registrar(message.senderPhoneNumber, "BOLETO_SELECIONADO", null, { idx, dataVencimento: boleto.dataVencimentoOriginal });
    let resultado;
    try {
      const res = await bancoBoletos.segundaViaBoleto({
        numeroCliente: config.sicoobNumeroCliente,
        codigoModalidade: 1,
        linhaDigitavel: boleto.linhaDigitavel,
      });
      resultado = res.body?.ok ? res.body.result?.response?.resultado : null;
    } catch (e) {
      console.error('[entrega] segundaViaBoleto falhou:', e?.message || e);
      resultado = null;
    }

    if (!resultado?.pdfBoleto) {
      telemetria.registrar(message.senderPhoneNumber, "ERRO_SERVICO", null, { etapa: "segunda_via" });
      await mensageria.enviarComBotaoMenu(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        mensagens.MSG_SEGUNDA_VIA_ERRO_SERVICO
      );
      // Mantém a lista para nova tentativa; renova o TTL.
      await mensageria.refrescarSessaoBoletos(message.senderPhoneNumber, boletos);
      return;
    }

    const recipient = message.senderPhoneNumber;
    const linhaDigitavel = resultado.linhaDigitavel || boleto.linhaDigitavel || "—";
    const caption = mensagens.MSG_BOLETO_CAPTION
      .replace("{DATA}", formatarData(resultado.dataVencimento))
      .replace("{VALOR}", formatarBRL(resultado.valor));

    // 1) PDF (ou texto, se o upload falhar) com vencimento + valor
    try {
      const pdfBuffer = Buffer.from(resultado.pdfBoleto, "base64");
      const { id: mediaId } = await notificador.uploadMedia(senderPhoneNumberId, pdfBuffer);
      await notificador.messageWithDocument(
        message.id, senderPhoneNumberId, recipient, mediaId, "boleto.pdf", caption
    );
    } catch (e) {
      console.error('[entrega] upload do PDF falhou, enviando como texto:', e?.message || e);
      await notificador.messageWithText(message.id, senderPhoneNumberId, recipient, caption);
    }

    // 2) e 3) linha digitável — rótulo e número em mensagens separadas (cópia fácil)
    await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, mensagens.MSG_LABEL_LINHA_DIGITAVEL);
    await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, linhaDigitavel);

    // 4) e 5) PIX copia e cola — rótulo e código em mensagens separadas
    if (resultado.qrCode) {
      await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, mensagens.MSG_LABEL_PIX);
      await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, resultado.qrCode);
    } else {
      await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, mensagens.MSG_PIX_INDISPONIVEL);
    }

    telemetria.registrar(recipient, "PDF_ENTREGUE", null, { dataVencimento: resultado.dataVencimento, valor: resultado.valor });

    // Mantém estado + boletos para o cliente escolher outra conta sem redigitar o
    // CPF; renova o TTL (janela deslizante).
    await mensageria.refrescarSessaoBoletos(recipient, boletos);
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
    const texto = (temOutras ? mensagens.MSG_POS_ENTREGA_OUTRAS : mensagens.MSG_POS_ENTREGA_UNICA)
      .replace("{DATA}", formatarData(boletoEntregue.dataVencimentoOriginal))
      .replace("{RESTANTES}", totalNaSessao - 1);

    const botoes = [];
    if (temOutras) {
      botoes.push({ id: mensagens.REPLY_VER_OUTRAS_ID, title: mensagens.REPLY_VER_OUTRAS_CTA });
    }
    botoes.push({ id: mensagens.REPLY_MENU_ID, title: mensagens.REPLY_MENU_CTA });

    try {
      await notificador.messageWithInteractiveReply(
        undefined, senderPhoneNumberId, message.senderPhoneNumber, texto, botoes
      );
    } catch (e) {
      // O boleto já foi entregue; o fechamento não pode derrubar o fluxo.
      console.error('[pos-entrega] botões não enviados, caindo para texto:', e?.message || e);
      await notificador.messageWithText(
        undefined, senderPhoneNumberId, message.senderPhoneNumber, texto
      ).catch(err => console.error('[pos-entrega] texto também falhou:', err?.message || err));
    }
  }

  return { handleSelecaoBoleto, fecharEntrega };
};
