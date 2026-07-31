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
      await sessao.clearCodigos(message.senderPhoneNumber);
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

    telemetria.registrar(recipient, "PDF_ENTREGUE", null, { dataVencimento: resultado.dataVencimento, valor: resultado.valor });

    // 2) os códigos ficam guardados e são entregues SOB DEMANDA, pela lista de
    // facilidades. Antes saíam todos de uma vez (4 mensagens) e empurravam o PDF
    // para fora da tela do celular.
    const codigos = {
      linhaDigitavel,
      qrCode: resultado.qrCode || null,
      restantes: boletos.length - 1,
    };
    await sessao.setCodigos(recipient, codigos);

    // Mantém estado + boletos para o cliente escolher outra conta sem redigitar o
    // CPF; renova o TTL (janela deslizante).
    await mensageria.refrescarSessaoBoletos(recipient, boletos);

    const corpo = codigos.restantes > 0
      ? mensagens.MSG_FACILIDADES_OUTRAS.replace("{RESTANTES}", codigos.restantes)
      : mensagens.MSG_FACILIDADES_UNICA;

    const enviou = await oferecerFacilidades(senderPhoneNumberId, recipient, codigos, corpo);
    if (!enviou) {
      await entregarCodigosEmTexto(senderPhoneNumberId, recipient, codigos);
    }
  }

  /**
   * Oferece os códigos de pagamento numa única lista interativa.
   *
   * Substitui o antigo fechamento em botões e as quatro mensagens de código.
   * O cliente toca no que quer e recebe só aquilo — o WhatsApp copia a mensagem
   * INTEIRA, então cada código precisa continuar chegando sozinho para a cópia
   * funcionar; o que mudou é que agora só chega o código pedido.
   *
   * A lista guarda só o que diz respeito a pagar; "Voltar ao menu" vai logo
   * depois, em mensagem própria, como botão verde — dentro da lista a saída
   * ficava escondida atrás de um toque, no meio das formas de pagamento.
   *
   * @returns {Promise<boolean>} false se a Meta recusou a lista.
   */
  async function oferecerFacilidades(senderPhoneNumberId, recipient, codigos, corpo) {
    try {
      await notificador.messageWithInteractiveList(
        undefined, senderPhoneNumberId, recipient, corpo,
        mensagens.MSG_FACILIDADES_BOTAO, mensagens.MSG_FACILIDADES_SECAO,
        view.montarRowsFacilidades({
          temPix: Boolean(codigos.qrCode),
          restantes: codigos.restantes,
        })
      );
    } catch (e) {
      console.error('[facilidades] lista recusada pela Meta:', e?.message || e);
      return false;
    }

    // A lista já chegou: uma falha aqui custa o botão de saída, não a entrega.
    // As palavras-chave ("menu", "sair", "voltar") seguem valendo de qualquer forma.
    try {
      await mensageria.enviarComBotaoMenu(
        undefined, senderPhoneNumberId, recipient, mensagens.MSG_FACILIDADES_SAIDA
      );
    } catch (e) {
      console.error('[facilidades] botão de saída não pôde ser enviado:', e?.message || e);
    }
    return true;
  }

  /**
   * Fallback do formato antigo: a Meta recusa a mensagem interativa inteira
   * (HTTP 400) por detalhe de formato. Sem esta rede o cliente ficaria com o PDF
   * e sem nenhum código — pior do que a chuva de mensagens que a lista evita.
   */
  async function entregarCodigosEmTexto(senderPhoneNumberId, recipient, codigos) {
    telemetria.registrar(recipient, "FACILIDADES_FALLBACK_TEXTO");

    await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, mensagens.MSG_LABEL_LINHA_DIGITAVEL);
    await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, codigos.linhaDigitavel);

    if (codigos.qrCode) {
      await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, mensagens.MSG_LABEL_PIX);
      await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, codigos.qrCode);
    } else {
      await notificador.messageWithText(undefined, senderPhoneNumberId, recipient, mensagens.MSG_PIX_INDISPONIVEL);
    }

    const botoes = [];
    if (codigos.restantes > 0) {
      botoes.push({ id: mensagens.REPLY_VER_OUTRAS_ID, title: mensagens.REPLY_VER_OUTRAS_CTA });
    }
    botoes.push({ id: mensagens.REPLY_MENU_ID, title: mensagens.REPLY_MENU_CTA });

    await notificador.messageWithInteractiveReply(
      undefined, senderPhoneNumberId, recipient, mensagens.APP_TRY_ANOTHER_MESSAGE, botoes
    ).catch(err => console.error('[facilidades] botões do fallback também falharam:', err?.message || err));
  }

  /**
   * Entrega o código que o cliente escolheu na lista de facilidades e reexibe a
   * lista logo abaixo — sem isso ele precisaria rolar a conversa de volta para
   * pedir o outro código, que é exatamente o problema que a lista resolve.
   *
   * @param {"linha"|"pix"} qual
   */
  async function enviarFacilidade(senderPhoneNumberId, message, qual) {
    const recipient = message.senderPhoneNumber;
    const codigos = await sessao.getCodigos(recipient);

    // TTL estourado: não há código para entregar e consultar o Sicoob de novo
    // exigiria saber qual conta era — o cliente recomeça pelo menu.
    if (!codigos) {
      telemetria.registrar(recipient, "SESSAO_EXPIRADA", null, { etapa: "facilidades" });
      await mensageria.enviarComBotaoMenu(
        message.id, senderPhoneNumberId, recipient, mensagens.MSG_FACILIDADE_EXPIRADA
      );
      await sessao.clearEstado(recipient);
      await sessao.clearBoletos(recipient);
      await sessao.clearCodigos(recipient);
      return;
    }

    const ehPix = qual === "pix";
    const codigo = ehPix ? codigos.qrCode : codigos.linhaDigitavel;

    // Só acontece se o cliente tocar numa lista antiga: a linha do PIX não é
    // oferecida quando o boleto não tem QR Code.
    if (!codigo) {
      await mensageria.enviarComBotaoMenu(
        message.id, senderPhoneNumberId, recipient, mensagens.MSG_PIX_INDISPONIVEL
      );
      return;
    }

    await notificador.messageWithText(message.id, senderPhoneNumberId, recipient, codigo);
    telemetria.registrar(recipient, "FACILIDADE_ENVIADA", null, { tipo: ehPix ? "pix" : "linha_digitavel" });

    // Renova o TTL dos códigos e da lista de contas: enquanto o cliente
    // interage, a sessão não pode expirar debaixo dele.
    await sessao.setCodigos(recipient, codigos);
    const boletos = await sessao.getBoletos(recipient);
    if (boletos && boletos.length) {
      await mensageria.refrescarSessaoBoletos(recipient, boletos);
    }

    const corpo = ehPix ? mensagens.MSG_FACILIDADES_APOS_PIX : mensagens.MSG_FACILIDADES_APOS_LINHA;
    const enviou = await oferecerFacilidades(senderPhoneNumberId, recipient, codigos, corpo);
    if (!enviou) {
      // O código já chegou; o que falta é a saída — nunca deixar sem botão.
      await mensageria.enviarComBotaoMenu(undefined, senderPhoneNumberId, recipient, corpo);
    }
  }

  return { handleSelecaoBoleto, enviarFacilidade, oferecerFacilidades };
};
