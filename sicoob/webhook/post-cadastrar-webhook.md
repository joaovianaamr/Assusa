# request
curl --location 'https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json' \
--header 'client_id: {{clientid}}' \
--data '{
  "url": "https://webhook.com",
  "codigoTipoMovimento": 7,
  "codigoPeriodoMovimento": 1,
  "email": "string"
}'

# response 201 created
{
  "resultado": {
    "idWebhook": 1234
  }
}

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks

Este serviço permite cadastrar uma URL que será notificada sempre que ocorrer um evento associado a um tipo de movimento. O webhook pode ser configurado para o período de movimentação atual (D0).
HEADERS
Content-Type

application/json
Authorization

Bearer {{token}}
Accept

application/json
client_id

{{clientid}}

# Bodyraw (json)
{
  "url": "https://webhook.com",
  "codigoTipoMovimento": 7,
  "codigoPeriodoMovimento": 1,
  "email": "string"
}