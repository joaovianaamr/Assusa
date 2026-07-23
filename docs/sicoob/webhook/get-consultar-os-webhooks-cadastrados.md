# request
curl --location 'https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks?idWebhook=&codigoTipoMovimento=7' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json' \
--header 'client_id: {{clientid}}' \
--data ''

# response
{
  "resultado": [
    {
      "idWebhook": 4,
      "url": "https://webhook.com",
      "email": "webhook@email.com",
      "codigoTipoMovimento": 7,
      "descricaoTipoMovimento": "Pagamento (Baixa operacional)",
      "codigoPeriodoMovimento": 1,
      "descricaoPeriodoMovimento": "Movimento atual (D0)",
      "codigoSituacao": 3,
      "descricaoSituacao": "Validado com sucesso",
      "dataHoraCadastro": "2024-09-03T00:27:18.483Z",
      "dataHoraUltimaAlteracao": "2024-09-06T12:24:11.296Z",
      "dataHoraInativacao": "2024-09-05T18:50:55.099Z",
      "descricaoMotivoInativacao": "Erro ao enviar notificação"
    }
  ]
}

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks?idWebhook=&codigoTipoMovimento=7

Serviço para consultar os detalhes dos webhooks cadastrados.
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
idWebhook

Identificador único do webhook
codigoTipoMovimento

7

Código do tipo de movimento do webhook. 7 - Pagamento (Baixa operacional)