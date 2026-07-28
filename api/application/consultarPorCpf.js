/**
 * Receber o CPF, consultar o banco e decidir o desfecho.
 *
 * Camada application: orquestra o caso de uso falando com as PORTAS
 * (api/domain/portas), nunca com adapters concretos. Quem liga porta e adapter
 * é o composition root.
 */

"use strict";

module.exports = function criar({ notificador, sessao, bancoBoletos, telemetria, mensagens, view, cpf, mensageria, listagem }) {
  async function handleCpfRecebido(senderPhoneNumberId, message) {
    const cpfDigits = cpf.apenasDigitos(message.text);

    if (!cpf.cpfValido(cpfDigits)) {
      telemetria.registrar(message.senderPhoneNumber, "CPF_INVALIDO", null, { cpf_recebido: cpfDigits });
      await mensageria.enviarComBotaoMenu(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        mensagens.MSG_CPF_INVALIDO
      );
      return;
    }

    await notificador.messageWithText(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      mensagens.MSG_CONSULTANDO_BOLETOS
    );

    let resultado;
    try {
      resultado = await bancoBoletos.listarBoletos({ numeroCpfCnpj: cpfDigits });
    } catch (e) {
      // Sem este log, um erro de programação vira "serviço indisponível" e
      // ninguém fica sabendo — foi exatamente o que aconteceu ao migrar para
      // dependências injetadas.
      console.error('[consultarPorCpf] listarBoletos falhou:', e?.message || e);
      telemetria.registrar(message.senderPhoneNumber, "ERRO_SERVICO", cpfDigits, { etapa: "listar_boletos" });
      await mensageria.enviarComBotaoMenu(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        mensagens.MSG_SEGUNDA_VIA_ERRO_SERVICO
      );
      await sessao.clearEstado(message.senderPhoneNumber);
      return;
    }

    const resultData = resultado.body?.result;
    const hasServiceError =
      resultData?.error ||
      (resultData?.status_code != null && resultData.status_code >= 400);

    if (hasServiceError) {
      console.error('[listarBoletos] erro da API Sicoob:', JSON.stringify(resultData));
      telemetria.registrar(message.senderPhoneNumber, "ERRO_SERVICO", cpfDigits, { etapa: "listar_boletos", detail: resultData });
      await mensageria.enviarComBotaoMenu(
        message.id,
        senderPhoneNumberId,
        message.senderPhoneNumber,
        mensagens.MSG_SEGUNDA_VIA_ERRO_SERVICO
      );
      await sessao.clearEstado(message.senderPhoneNumber);
      return;
    }

    const raw = resultData?.response;
    const boletos = Array.isArray(raw) ? raw
      : Array.isArray(raw?.resultado) ? raw.resultado
      : [];

    if (!boletos.length) {
      console.warn('[listarBoletos] resposta vazia da API Sicoob:', JSON.stringify(resultData));
      await responderSemBoletosEmAberto(senderPhoneNumberId, message, cpfDigits);
      await sessao.clearEstado(message.senderPhoneNumber);
      return;
    }

    await listagem.apresentarBoletos(senderPhoneNumberId, message, cpfDigits, boletos);
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
    let mensagem = mensagens.MSG_NENHUM_BOLETO;
    let evento = "NENHUM_BOLETO";

    try {
      const historico = await bancoBoletos.listarBoletos({
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
          mensagem = mensagens.MSG_CLIENTE_EM_DIA.replace("{CPF}", cpf.mascararCpf(cpfDigits));
          evento = "CLIENTE_EM_DIA";
        } else {
          mensagem = mensagens.MSG_CPF_NAO_ENCONTRADO;
          evento = "CPF_NAO_ENCONTRADO";
        }
      }
    } catch (e) {
      console.warn('[historico] consulta sem filtro de situação falhou:', e?.message || e);
    }

    telemetria.registrar(message.senderPhoneNumber, evento, cpfDigits);
    await mensageria.enviarComBotaoMenu(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      mensagem
    );
  }

  return { handleCpfRecebido, responderSemBoletosEmAberto };
};
