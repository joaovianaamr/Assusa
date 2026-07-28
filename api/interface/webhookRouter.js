/**
 * Roteamento da conversa: dado o estado da sessão e o que chegou do WhatsApp,
 * decide QUAL caso de uso executar.
 *
 * Camada interface. Não contém regra de negócio nem I/O direto — chama
 * `application` e as portas. Antes isto vivia junto de tudo o mais em
 * `services/conversation.js`, que importava 9 dos 10 módulos do projeto.
 */

"use strict";

module.exports = function criar({
  sessao, telemetria, mensagens, notificador,
  Message, Status,
  mensageria, consulta, listagem, entrega,
}) {
  /** Palavras que devolvem o cliente ao início, em qualquer estado. */
  const PALAVRAS_SAIDA = ["menu", "sair", "voltar", "cancelar", "inicio"];
  const normalize = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  /**
   * Botões que valem como "voltar ao início": chegando um deles em qualquer
   * estado, a sessão é descartada antes do dispatch.
   *
   * REPLY_VER_OUTRAS_ID de propósito NÃO entra aqui — ele reexibe a lista
   * guardada em vez de destruí-la.
   */
  const MENU_BUTTONS = [
    mensagens.REPLY_SEGUNDA_VIA_ID,
    mensagens.REPLY_HORARIO_ID,
    mensagens.REPLY_MENU_ID,
  ];

  async function handleMessage(senderPhoneNumberId, rawMessage) {
    const message = new Message(rawMessage);
    const estadoAtual = await sessao.getEstado(message.senderPhoneNumber);

    if (message.type === "unknown" && PALAVRAS_SAIDA.includes(normalize(message.text || ""))) {
      await sessao.clearEstado(message.senderPhoneNumber);
      await sessao.clearBoletos(message.senderPhoneNumber);
      telemetria.registrar(message.senderPhoneNumber, "FLUXO_CANCELADO");
      await mensageria.sendMenuPrincipal(
        message.id, senderPhoneNumberId, message.senderPhoneNumber, mensagens.APP_DEFAULT_MESSAGE
      );
      return;
    }

    // "Ver outras contas" vale em qualquer estado e é tratado antes da máquina
    // de estados: dentro de aguardando_selecao_boleto ele cairia no caso de uso
    // de entrega e viraria "não entendi sua resposta".
    if (message.type === mensagens.REPLY_VER_OUTRAS_ID) {
      await listagem.reexibirBoletos(senderPhoneNumberId, message);
      return;
    }

    if (estadoAtual === "aguardando_cpf") {
      if (!MENU_BUTTONS.includes(message.type)) {
        await consulta.handleCpfRecebido(senderPhoneNumberId, message);
        return;
      }
      await sessao.clearEstado(message.senderPhoneNumber);
    }

    if (estadoAtual === "aguardando_selecao_boleto") {
      if (!MENU_BUTTONS.includes(message.type)) {
        await entrega.handleSelecaoBoleto(senderPhoneNumberId, message);
        return;
      }
      await sessao.clearEstado(message.senderPhoneNumber);
      await sessao.clearBoletos(message.senderPhoneNumber);
    }

    switch (message.type) {
      case mensagens.REPLY_SEGUNDA_VIA_ID:
        telemetria.registrar(message.senderPhoneNumber, "SEGUNDA_VIA_INICIADA");
        await sessao.setEstado(message.senderPhoneNumber, "aguardando_cpf");
        await mensageria.handleSolicitacaoSegundaVia(
          message.id, senderPhoneNumberId, message.senderPhoneNumber
        );
        break;
      case mensagens.REPLY_HORARIO_ID:
        telemetria.registrar(message.senderPhoneNumber, "HORARIO_CONSULTADO");
        await notificador.messageWithText(
          message.id, senderPhoneNumberId, message.senderPhoneNumber,
          mensagens.MSG_HORARIO_FUNCIONAMENTO
        );
        break;
      // Botão "Voltar ao menu" das mensagens de fim de fluxo. Cairia no default
      // de qualquer forma; o case existe para medir quanto ele é usado.
      case mensagens.REPLY_MENU_ID:
        telemetria.registrar(message.senderPhoneNumber, "MENU_VIA_BOTAO");
        await mensageria.sendMenuPrincipal(
          message.id, senderPhoneNumberId, message.senderPhoneNumber, mensagens.APP_DEFAULT_MESSAGE
        );
        break;
      default:
        telemetria.registrar(message.senderPhoneNumber, "MENU_EXIBIDO");
        await mensageria.sendMenuPrincipal(
          message.id, senderPhoneNumberId, message.senderPhoneNumber, mensagens.APP_DEFAULT_MESSAGE
        );
        break;
    }
  }

  /**
   * Avisa o cliente quando `handleMessage` estourou de um jeito não previsto.
   * Chamado pelo `.catch` do webhook em `app.js` — o cliente não pode ficar
   * esperando uma resposta que nunca vem.
   */
  async function avisarFalhaInesperada(senderPhoneNumberId, rawMessage) {
    const recipient = rawMessage?.from;
    if (!recipient) return;
    await mensageria.enviarComBotaoMenu(
      undefined, senderPhoneNumberId, recipient, mensagens.MSG_ERRO_INESPERADO
    );
  }

  async function handleStatus(senderPhoneNumberId, rawStatus) {
    const status = new Status(rawStatus);

    if (!(status.status === 'delivered' || status.status === 'read')) {
      return;
    }

    // Só manda follow-up se a mensagem estiver marcada no cache.
    if (await sessao.remove(status.messageId)) {
      await mensageria.sendMenuPrincipal(
        undefined, senderPhoneNumberId, status.recipientPhoneNumber,
        mensagens.APP_TRY_ANOTHER_MESSAGE
      );
    }
  }

  return { handleMessage, handleStatus, avisarFalhaInesperada };
};
