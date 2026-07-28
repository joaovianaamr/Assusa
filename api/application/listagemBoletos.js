/**
 * Montar e enviar a lista de contas em aberto.
 *
 * Camada application: orquestra o caso de uso falando com as PORTAS
 * (api/domain/portas), nunca com adapters concretos. Quem liga porta e adapter
 * é o composition root.
 */

"use strict";

module.exports = function criar({ notificador, sessao, bancoBoletos, telemetria, mensagens, view, config, mensageria }) {
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
      await notificador.messageWithText(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        mensagens.MSG_AVISO_MUITOS_BOLETOS
          .replace("{TOTAL}", boletos.length)
          .replace("{EXIBIDOS}", exibir.length)
    );
    }

    // A listagem (listar) traz vencimento/valor ORIGINAIS; a 2ª via recalcula para
    // pagamento hoje (com juros/multa). Enriquecemos com o valor atualizado para
    // que a listagem e o PDF entregue mostrem o mesmo valor a pagar.
    const enriquecidos = await enriquecerBoletos(exibir);

    telemetria.registrar(message.senderPhoneNumber, "BOLETOS_LISTADOS", cpfDigits, { total: boletos.length, exibidos: enriquecidos.length });

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
      await sessao.clearEstado(message.senderPhoneNumber);
      await sessao.clearBoletos(message.senderPhoneNumber);
      return;
    }

    await sessao.setBoletos(message.senderPhoneNumber, enriquecidos);
    await sessao.setEstado(message.senderPhoneNumber, "aguardando_selecao_boleto");
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
        usarLista ? mensagens.MSG_SELECIONAR_BOLETO_LISTA : mensagens.MSG_SELECIONAR_BOLETO,
        boletos
      );

      if (usarLista) {
        await notificador.messageWithInteractiveList(
          message.id, senderPhoneNumberId, recipient, corpo,
          mensagens.MSG_LISTA_BOTAO, mensagens.MSG_LISTA_SECAO,
          view.montarRowsLista(boletos)
        );
      } else {
        await notificador.messageWithInteractiveReply(
          message.id, senderPhoneNumberId, recipient, corpo,
          view.montarBotoesBoletos(boletos)
        );
      }
      return true;
    } catch (e) {
      console.error('[selecao] envio interativo falhou, caindo para texto:', e?.message || e);
    }

    try {
      await notificador.messageWithText(
        message.id,
        senderPhoneNumberId,
        recipient,
        view.montarCorpoSelecao(mensagens.MSG_SELECIONAR_BOLETO_TEXTO, boletos)
      );
      telemetria.registrar(recipient, "SELECAO_FALLBACK_TEXTO", null, { exibidos: boletos.length });
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
        bancoBoletos.segundaViaBoleto({
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

  /**
   * Reexibe a lista guardada no Redis, sem consultar o Sicoob de novo: em até
   * 30 min os valores não mudam de forma perceptível, e assim o cliente não
   * espera nem gasta requisição (o endpoint de pagadores limita a 10/s).
   */
  async function reexibirBoletos(senderPhoneNumberId, message) {
    const boletos = await sessao.getBoletos(message.senderPhoneNumber);

    if (!boletos || !boletos.length) {
      telemetria.registrar(message.senderPhoneNumber, "SESSAO_EXPIRADA");
      await mensageria.enviarComBotaoMenu(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        mensagens.MSG_SESSAO_EXPIRADA
      );
      await sessao.clearEstado(message.senderPhoneNumber);
      return;
    }

    telemetria.registrar(message.senderPhoneNumber, "LISTA_REEXIBIDA", null, { total: boletos.length });
    const enviou = await enviarSelecaoBoletos(
      senderPhoneNumberId, message, boletos, view.deveUsarLista(boletos.length)
    );
    if (enviou) {
      await mensageria.refrescarSessaoBoletos(message.senderPhoneNumber, boletos);
    }
  }

  return { apresentarBoletos, enviarSelecaoBoletos, enriquecerBoletos, reexibirBoletos };
};
