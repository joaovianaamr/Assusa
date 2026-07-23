# request
curl --location 'https://api.sicoob.com.br/pagamentos/v3/boletos/integer/baixar' \
--header 'Content-Type: application/json' \
--header 'client_id: {{clientid}}' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json' \
--data '{
  "numeroCliente": 5224,
  "codigoModalidade": 1
}'


# url
https://api.sicoob.com.br/cobranca-bancaria/v3/boletos/:nossoNumero/baixar

Serviço para comandar a baixa de boletos informados.
HEADERS
Content-Type

application/json
client_id

{{clientid}}
Authorization

Bearer {{token}}
Accept

application/json
PATH VARIABLES
nossoNumero

integer

Número que identifica o boleto de cobrança no Sisbr
# Bodyraw (json)
{
  "numeroCliente": 5224,
  "codigoModalidade": 1
}
