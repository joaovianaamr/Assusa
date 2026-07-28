/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

module.exports = Object.freeze({
  // Expected messages from the user
  USER_START_MESSAGE: "Tap send to get started",

  // Response messages
  APP_DEFAULT_MESSAGE: "Olá! Bem-vindo à Assusa Distribuidora de Água. Como podemos te ajudar hoje?\n\nA qualquer momento, digite *menu*, *sair* ou *voltar* para retornar ao início.",
  APP_TRY_ANOTHER_MESSAGE: "Posso te ajudar com mais alguma coisa?",
  MSG_HORARIO_FUNCIONAMENTO:
    "Nosso atendimento funciona de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h.",
  MSG_SOLICITAR_CPF_1:
    "Digite o CPF do titular da conta:",
  // Um exemplo por linha e em negrito (* do WhatsApp): o mesmo CPF nas duas
  // grafias, para deixar claro que tanto faz enviar com ou sem pontos.
  MSG_SOLICITAR_CPF_2:
    "Pode enviar dos dois jeitos:\n\n*12345678900*\n*123.456.789-00*",

  // ── Quatro desfechos distintos da consulta por CPF ────────────────────────
  // 1) o número digitado não é um CPF válido
  MSG_CPF_INVALIDO:
    "Esse CPF parece incompleto ou incorreto.\n\nConfira os 11 números e envie de novo.",
  // 2) o CPF é cliente, mas não deve nada
  MSG_CLIENTE_EM_DIA:
    "Boa notícia: não há contas em aberto no CPF {CPF}.\n\nVocê está em dia com a Assusa. 😊",
  // 3) o CPF não aparece em nenhum registro nosso
  MSG_CPF_NAO_ENCONTRADO:
    "Não localizei esse CPF no cadastro da Assusa.\n\nConfira se digitou o CPF do *titular* da conta de água. Se estiver certo, ligue para (31) 3624-8550.",
  // 4) fallback: a consulta de histórico falhou, então não dá para afirmar
  //    se o cliente está em dia ou se o CPF é desconhecido
  MSG_NENHUM_BOLETO:
    "Não encontrei contas em aberto nesse CPF.\n\nIsso pode ser porque está tudo pago, ou porque o CPF não é o do titular da conta. Em caso de dúvida, ligue para (31) 3624-8550.",
  // Cabeçalho da listagem. {TOTAL} = nº de contas; {LISTA} = linhas enumeradas.
  // Versão com botões (até 3 contas).
  MSG_SELECIONAR_BOLETO:
    "Encontrei {TOTAL} conta(s) em aberto. O valor já está atualizado para pagamento hoje.\n\n{LISTA}\n\nToque no botão da conta que deseja pagar:",
  // Fallback: usado quando a Meta recusa a mensagem interativa. Sem botão nem
  // lista, o cliente escolhe respondendo o número da conta.
  MSG_SELECIONAR_BOLETO_TEXTO:
    "Encontrei {TOTAL} conta(s) em aberto. O valor já está atualizado para pagamento hoje.\n\n{LISTA}\n\nResponda com o *número* da conta que deseja pagar (1, 2, 3...).",
  // Versão com lista interativa (4 contas ou mais).
  MSG_SELECIONAR_BOLETO_LISTA:
    "Encontrei {TOTAL} contas em aberto. O valor já está atualizado para pagamento hoje.\n\n{LISTA}\n\nToque em *Ver minhas contas* aqui embaixo e escolha a que deseja pagar:",
  // Linha de cada conta na listagem. {N}=número, {DATA}=vencimento original, {VALOR}=valor atualizado.
  MSG_SELECIONAR_BOLETO_ITEM:
    "{N}) Conta de {DATA} — R$ {VALOR}",
  MSG_CONSULTANDO_BOLETOS:
    "Aguarde, estou consultando seus boletos...",
  // Só aparece acima do teto de linhas da lista interativa (10 contas).
  MSG_AVISO_MUITOS_BOLETOS:
    "Você possui {TOTAL} contas em aberto. Estou mostrando as {EXIBIDOS} mais antigas — para as demais, ligue para (31) 3624-8550.",
  // Lista interativa (usada a partir de 4 contas).
  MSG_LISTA_BOTAO: "Ver minhas contas",
  MSG_LISTA_SECAO: "Contas em aberto",
  MSG_LISTA_ITEM_DESCRICAO: "Valor atualizado: R$ {VALOR}",
  // Entrega do boleto (mensagens separadas para facilitar a cópia).
  MSG_BOLETO_CAPTION:
    "✅ Sua 2ª via\n\nPague até {DATA}\nValor: R$ {VALOR}",
  MSG_LABEL_LINHA_DIGITAVEL:
    "Linha digitável do boleto:",
  MSG_LABEL_PIX:
    "PIX copia e cola:",
  MSG_PIX_INDISPONIVEL:
    "PIX não disponível para este boleto.",
  // ── Fechamento depois de entregar o boleto ────────────────────────────────
  // Sem isto a conversa morria no PIX e o cliente não sabia que podia pedir as
  // outras contas sem redigitar o CPF. {DATA} = vencimento da conta entregue.
  MSG_POS_ENTREGA_OUTRAS:
    "Pronto! Sua conta de {DATA} foi enviada. ✅\n\nVocê ainda tem {RESTANTES} conta(s) em aberto. O que deseja agora?",
  MSG_POS_ENTREGA_UNICA:
    "Pronto! Sua conta de {DATA} foi enviada. ✅\n\nPosso ajudar com mais alguma coisa?",
  // A lista guardada no Redis expirou (TTL) e não há o que reexibir.
  MSG_SESSAO_EXPIRADA:
    "Já faz um tempo desde a sua consulta e não tenho mais sua lista de contas.\n\nToque no botão abaixo para consultar de novo.",
  // Resposta não reconhecida enquanto o cliente escolhe a conta.
  MSG_SELECAO_NAO_ENTENDIDA:
    "Não entendi sua resposta.\n\nResponda com o *número* da conta que deseja pagar, de 1 a {TOTAL}.",
  // Última rede de segurança: o fluxo estourou de um jeito não previsto.
  MSG_ERRO_INESPERADO:
    "Tive um problema aqui e não consegui concluir seu atendimento.\n\nToque no botão abaixo para recomeçar, ou ligue para (31) 3624-8550.",
  MSG_SEGUNDA_VIA_ERRO_SERVICO:
    "Nosso sistema está fora do ar neste momento.\n\nTente de novo em alguns minutos ou ligue para (31) 3624-8550.",

  // Reply prefix for boleto selection buttons
  REPLY_BOLETO_PREFIX: "boleto-",

  // CTA texts
  REPLY_SEGUNDA_VIA_CTA: "2ª via de conta",
  REPLY_HORARIO_CTA: "Horário atendimento",
  REPLY_MENU_CTA: "Voltar ao menu",
  REPLY_VER_OUTRAS_CTA: "Ver outras contas",

  // Reply Button IDs
  REPLY_SEGUNDA_VIA_ID: "assusa-segunda-via",
  REPLY_HORARIO_ID: "assusa-horario-funcionamento",
  REPLY_MENU_ID: "assusa-menu",
  // NÃO entra em MENU_BUTTONS: reexibe a lista guardada em vez de descartá-la.
  REPLY_VER_OUTRAS_ID: "assusa-ver-outras"
});
