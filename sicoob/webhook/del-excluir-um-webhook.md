# request
curl --location -g --request DELETE 'https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks/{idWebhook}' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json' \
--header 'client_id: {{clientid}}' \
--data ''

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks/{idWebhook}

Serviço responsável por remover permanentemente um webhook registrado, encerrando o envio de notificações para a URL vinculada."
HEADERS
Content-Type

application/json
Authorization

Bearer {{token}}
Accept

application/json
client_id

{{clientid}}

# response 
204 no content

