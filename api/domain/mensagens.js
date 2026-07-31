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
    "Digite o CPF cadastrado na ASSUSA (titular da conta)",
  // `handleCpfRecebido` faz replace(/\D/g, ""), então qualquer pontuação serve —
  // ponto, hífen, espaço ou nenhuma. Os itens abaixo são EXEMPLOS, não os únicos
  // formatos aceitos; o texto precisa deixar isso claro para o cliente não achar
  // que digitou errado. Lista com "- ": o WhatsApp renderiza em tópicos e, onde
  // não renderizar, o traço já serve de marcador. Nada de `*`, que ali vira
  // negrito em vez de tópico.
  // Sempre o MESMO CPF nas três grafias — números diferentes fariam parecer que
  // cada linha é um caso distinto. De propósito não há exemplo com frase solta
  // ("meu cpf e ..."), embora funcione: confundiria mais do que ajudaria.
  //
  // O marcador "•" é literal, e não a sintaxe de lista "- " do WhatsApp: o app
  // trata a lista como um bloco e acrescenta uma margem depois dela, que aparece
  // como linha em branco sobrando no fim da mensagem (confirmado em aparelho
  // real, jul/2026). Com o bullet no texto o visual é o mesmo, sem a sobra.
  MSG_SOLICITAR_CPF_2:
    "Pode digitar do jeito que for mais fácil. Exemplos:\n• 12345678900\n• 123.456.789-00\n• 123 456 789 00",

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
  // Versão com lista interativa (4 contas ou mais). Só o cabeçalho, de propósito:
  // as linhas da lista já trazem data E valor de cada conta, então o corpo
  // enumerado repetia tudo e transformava a escolha num paredão de texto —
  // justamente o que confunde o público idoso. Nos outros dois formatos a
  // enumeração continua, porque o botão só cabe "1 - Conta 16/05" (sem valor) e
  // o fallback em texto não tem nada além do corpo.
  // A instrução "Toque em *Ver minhas contas*" também saiu: ela repetia, em
  // palavras, o rótulo do botão logo abaixo (MSG_LISTA_BOTAO).
  MSG_SELECIONAR_BOLETO_LISTA:
    "Encontrei {TOTAL} contas em aberto. O valor já está atualizado para pagamento hoje.",
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
  // Entrega do boleto: o PDF já traz vencimento e valor na legenda.
  MSG_BOLETO_CAPTION:
    "✅ Sua 2ª via\n\nPague até {DATA}\nValor: R$ {VALOR}",
  // ── Facilidades de pagamento (lista interativa, sob demanda) ──────────────
  // Antes a entrega despejava 6 mensagens de uma vez (PDF, rótulo + linha
  // digitável, rótulo + PIX, fechamento). No celular as primeiras subiam para
  // fora da tela e, com o teclado aberto, sobrava meia tela de conversa — o
  // público é majoritariamente idoso e se perdia. Agora o PDF vem seguido de UMA
  // lista: o cliente toca no código que quer e recebe só ele, sozinho na
  // mensagem (o WhatsApp copia a mensagem inteira, então cada código precisa
  // vir isolado para a cópia funcionar).
  MSG_FACILIDADES_OUTRAS:
    "Como você prefere pagar?\n\nToque em *Formas de pagar* aqui embaixo e escolha o código que deseja copiar.\n\nVocê ainda tem {RESTANTES} conta(s) em aberto.",
  MSG_FACILIDADES_UNICA:
    "Como você prefere pagar?\n\nToque em *Formas de pagar* aqui embaixo e escolha o código que deseja copiar.",
  // Reexibida depois de entregar um código, para a lista não sumir da tela.
  MSG_FACILIDADES_APOS_LINHA:
    "☝️ Essa é a *linha digitável*. Toque no número acima para copiar e pague no banco, na lotérica ou pelo aplicativo.\n\nPrecisa de mais alguma coisa? Toque em *Formas de pagar*.",
  MSG_FACILIDADES_APOS_PIX:
    "☝️ Esse é o *PIX copia e cola*. Toque no código acima para copiar e cole no aplicativo do seu banco, na opção PIX.\n\nPrecisa de mais alguma coisa? Toque em *Formas de pagar*.",
  MSG_FACILIDADES_BOTAO: "Formas de pagar",
  MSG_FACILIDADES_SECAO: "Como deseja pagar",
  MSG_FACILIDADE_LINHA_DESC: "Pague no banco, na lotérica ou pelo aplicativo",
  MSG_FACILIDADE_PIX_DESC: "Pague pelo aplicativo do seu banco",
  MSG_FACILIDADE_OUTRAS_DESC: "Você ainda tem {RESTANTES} conta(s) em aberto",
  MSG_FACILIDADE_MENU_DESC: "Encerrar e voltar ao início",
  // Fallback: a Meta recusou a lista interativa. Cai para o formato antigo —
  // rótulo e código em mensagens separadas, tudo de uma vez.
  MSG_LABEL_LINHA_DIGITAVEL:
    "Linha digitável do boleto:",
  MSG_LABEL_PIX:
    "PIX copia e cola:",
  MSG_PIX_INDISPONIVEL:
    "PIX não disponível para este boleto.",
  // O código pedido não está mais no Redis (TTL estourado).
  MSG_FACILIDADE_EXPIRADA:
    "Já faz um tempo desde a sua consulta e não tenho mais os códigos dessa conta.\n\nToque no botão abaixo para consultar de novo.",
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
  REPLY_LINHA_CTA: "Linha digitável",
  REPLY_PIX_CTA: "PIX copia e cola",

  // Reply Button IDs
  REPLY_SEGUNDA_VIA_ID: "assusa-segunda-via",
  REPLY_HORARIO_ID: "assusa-horario-funcionamento",
  REPLY_MENU_ID: "assusa-menu",
  // NÃO entra em MENU_BUTTONS: reexibe a lista guardada em vez de descartá-la.
  REPLY_VER_OUTRAS_ID: "assusa-ver-outras",
  // Idem: entregam um código da conta já enviada e reexibem a lista, então
  // limpar a sessão destruiria justamente o que eles usam.
  REPLY_LINHA_ID: "assusa-linha-digitavel",
  REPLY_PIX_ID: "assusa-pix-copia-cola"
});
