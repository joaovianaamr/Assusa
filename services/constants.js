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
  MSG_REDIRECIONAMENTO_ATENDENTE:
    "Nossos atendentes estão disponíveis de segunda a sexta, das 8h às 18h. Para falar com um atendente agora, ligue: (31)3624-8550.",
  MSG_HORARIO_FUNCIONAMENTO:
    "Nosso atendimento funciona de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h.",
  MSG_SOLICITAR_CPF:
    "Para enviar sua 2ª via, preciso do seu CPF.\n\nDigite os 11 números do CPF. Pode enviar com ou sem pontos.\n\nExemplos válidos:\n*123.456.789-00*\n*12345678900*",
  MSG_SEGUNDA_VIA_SUCESSO:
    "Aqui está a sua 2ª via. O vencimento é {DATA}. Você pode pagar pelo código de barras abaixo ou pelo PIX.",
  MSG_SEGUNDA_VIA_ERRO:
    "Não encontrei uma conta ativa com esse CPF. Verifique os dados e tente novamente, ou fale com nosso atendente.",
  MSG_NENHUM_BOLETO:
    "Não encontrei boletos em aberto para este CPF. Se achar que é um engano, fale com nosso atendente.",
  MSG_SELECIONAR_BOLETO:
    "Encontrei {TOTAL} boleto(s) em aberto no período dos últimos 35 dias.\n\nSelecione o que deseja pagar:",
  MSG_CONSULTANDO_BOLETOS:
    "Aguarde, estou consultando seus boletos...",
  MSG_AVISO_MUITOS_BOLETOS:
    "Você possui {TOTAL} boletos em aberto. Exibindo os 3 mais antigos — para os demais, fale com nosso atendente: (31) 3624-8550.",
  MSG_BOLETO_DETALHES:
    "Vencimento: {DATA} | Valor: R$ {VALOR}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nPIX copia e cola:\n{QR_CODE}",
  MSG_SEGUNDA_VIA_ERRO_SERVICO:
    "Nosso serviço está temporariamente indisponível. Tente novamente em alguns instantes ou ligue: (31) 3624-8550.",

  // Reply prefix for boleto selection buttons
  REPLY_BOLETO_PREFIX: "boleto-",

  // CTA texts
  REPLY_SEGUNDA_VIA_CTA: "2ª via de conta",
  REPLY_FALAR_ATENDENTE_CTA: "Falar com atendente",
  REPLY_HORARIO_CTA: "Horário atendimento",

  // Reply Button IDs
  REPLY_SEGUNDA_VIA_ID: "assusa-segunda-via",
  REPLY_FALAR_ATENDENTE_ID: "assusa-falar-atendente",
  REPLY_HORARIO_ID: "assusa-horario-funcionamento"
});
