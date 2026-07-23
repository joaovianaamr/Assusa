# request
curl --location -g --request PATCH 'https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks/{idWebhook}' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json' \
--header 'client_id: {{clientid}}' \
--data '{
  "url": "https://webhook.com",
  "email": "string"
}'

# response

204 no content

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks/{idWebhook}

Serviço de atualização de webhook. Ao modificar a URL, a situação do webhook será automaticamente alterada para '1 - Aguardando validação' e permanecerá assim até que a nova URL seja validada com sucesso.
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
  "email": "string"
}