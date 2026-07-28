/**
 * Envios compartilhados entre os casos de uso.
 *
 * Camada application: orquestra o caso de uso falando com as PORTAS
 * (api/domain/portas), nunca com adapters concretos. Quem liga porta e adapter
 * é o composition root.
 */

"use strict";

module.exports = function criar({ notificador, sessao, mensagens }) {
  function sendMenuPrincipal(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    messageBody
  ) {
    return notificador.messageWithInteractiveReply(
      messageId,
      senderPhoneNumberId,
      recipientPhoneNumber,
      messageBody,
      [
        {
          id: mensagens.REPLY_SEGUNDA_VIA_ID,
          title: mensagens.REPLY_SEGUNDA_VIA_CTA,
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
      await notificador.messageWithInteractiveReply(
        messageId,
        senderPhoneNumberId,
        recipientPhoneNumber,
        texto,
        [{ id: mensagens.REPLY_MENU_ID, title: mensagens.REPLY_MENU_CTA }]
      );
      return;
    } catch (e) {
      console.error('[menu] botão de retorno não pôde ser enviado, caindo para texto:', e?.message || e);
    }
    await notificador.messageWithText(messageId, senderPhoneNumberId, recipientPhoneNumber, texto);
  }

  async function handleSolicitacaoSegundaVia(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber
  ) {
    await notificador.messageWithText(
      messageId,
      senderPhoneNumberId,
      recipientPhoneNumber,
      mensagens.MSG_SOLICITAR_CPF_1
    );
    await notificador.messageWithText(
      undefined,
      senderPhoneNumberId,
      recipientPhoneNumber,
      mensagens.MSG_SOLICITAR_CPF_2
    );
  }

  /**
   * Renova o TTL do estado e do cache de boletos, mantendo a lista clicável
   * enquanto o cliente continua interagindo.
   */
  async function refrescarSessaoBoletos(phoneNumber, boletos) {
    await sessao.setEstado(phoneNumber, "aguardando_selecao_boleto");
    await sessao.setBoletos(phoneNumber, boletos);
  }

  return { sendMenuPrincipal, enviarComBotaoMenu, handleSolicitacaoSegundaVia, refrescarSessaoBoletos };
};
