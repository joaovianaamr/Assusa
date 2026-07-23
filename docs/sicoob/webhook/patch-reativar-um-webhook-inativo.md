# request
curl --location -g --request PATCH 'https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks/{idWebhook}/reativar' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json' \
--header 'client_id: {{clientid}}' \
--data ''

# response
204 no content

https://api.sicoob.com.br/cobranca-bancaria/v3/webhooks/{idWebhook}/reativar

Serviço de reativação de webhook desativado, restabelecendo o recebimento de notificações. A situação do webhook será atualizada para '1 - Aguardando validação' e permanecerá assim até que a URL seja validada com sucesso.
HEADERS
Content-Type

application/json
Authorization

Bearer {{token}}
Accept

application/json
client_id

{{clientid}}

