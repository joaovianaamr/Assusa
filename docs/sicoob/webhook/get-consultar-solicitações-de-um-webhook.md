# request
curl --location -g 'https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks/{idWebhook}/solicitacoes?dataSolicitacao=yyyy-MM-dd&pagina=1&codigoSolicitacaoSituacao=3' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json' \
--header 'client_id: {{clientid}}' \
--data ''

# response
{
  "resultado": [
    {
      "paginalAtual": 1,
      "totalPaginas": 2,
      "totalRegistros": 100,
      "webhookSolicitacoes": [
        {
          "codigoWebhookSituacao": 3,
          "descricaoWebhookSituacao": "Validado com sucesso",
          "codigoSolicitacaoSituacao": 3,
          "descricaoSolicitacaoSituacao": "Enviado com sucesso",
          "codigoTipoMovimento": 7,
          "descricaoTipoMovimento": "Pagamento (Baixa operacional)",
          "codigoPeriodoMovimento": 1,
          "descricaoPeriodoMovimento": "Movimento atual (D0)",
          "descricaoErroProcessamento": "Erro ao enviar notificação",
          "dataHoraCadastro": "2024-09-04T15:43:56.000Z",
          "validacaoWebhook": false,
          "webhookNotificacoes": [
            {
              "url": "https://webhook.com",
              "dataHoraInicio": "2024-09-08T15:50:38.077Z",
              "dataHoraFim": "2024-09-08T15:51:38.077Z",
              "tempoComunicao": 60,
              "codigoStatusRequisicao": 200,
              "descricaoMensagemRetorno": "{\"messsage\":\"Webhook recebido com sucesso!\"}"
            }
          ]
        }
      ]
    }
  ]
}

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks/{idWebhook}/solicitacoes?dataSolicitacao=yyyy-MM-dd&pagina=1&codigoSolicitacaoSituacao=3

Consulta as solicitações de notificação para um webhook com base na data de solicitação informada.
Retorna o histórico das tentativas de notificação, incluindo o status e a resposta da requisição.
HEADERS
Content-Type

application/json
Authorization

Bearer {{token}}
Accept

application/json
client_id

{{clientid}}
PARAMS
dataSolicitacao

yyyy-MM-dd

Data da solicitação.
pagina

1

Número da página a ser consultada.
codigoSolicitacaoSituacao

3

Código da situação da solicitação do webhook.

3 - Enviado com sucesso 6 - Erro no envio