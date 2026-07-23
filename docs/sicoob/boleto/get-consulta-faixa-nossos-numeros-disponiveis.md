# request
curl --location 'https://api.sicoob.com.br/cobranca-bancaria/v3/boletos/faixas-nosso-numero-disponiveis?numeroCliente=integer&codigoModalidade=integer&quantidade=integer&numeroContratoCobranca=integer' \
--header 'Content-Type: application/json' \
--header 'client_id: {{clientid}}' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json'

# response 200 ok
{
  "resultado": [
    {
      "numeroCliente": 5224,
      "nome": "JOSE PEREIRA",
      "codigoModalidade": 1,
      "numeroInicial": 1,
      "numeroFinal": 10,
      "quantidade": 10
    }
  ]
}

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/boletos/faixas-nosso-numero-disponiveis?numeroCliente=integer&codigoModalidade=integer&quantidade=integer&numeroContratoCobranca=integer

Serviço para consulta de dados de faixas de nosso número disponíveis.

Serviço para consulta de dados de faixas de nosso número disponíveis.
Quando o campo validaDigitoVerificadorNossoNumero retornar o valor "0" a faixa "numeroInicial" e "numeroFinal" refere-se a numeração final (exemplo: 10 e 15 - utilização: 1-0 1-1 1-2 1-3 1-4 1-5).
Mas se o campo validaDigitoVerificadorNossoNumero retornar o valor "1" a faixa "numeroInicial" e "numeroFinal" deverá ser calculado o DV (exemplo: 10 e 15 - utilização: 10-4 11-8 12-0 13-1 14-7 15-9).
HEADERS
Content-Type

application/json
client_id

{{clientid}}
Authorization

Bearer {{token}}
Accept

application/json
PARAMS
numeroCliente

integer

(required) Número que identifica o contrato do beneficiário no Sisbr.
codigoModalidade

integer

(required) Identifica a modalidade do boleto.

1 SIMPLES COM REGISTRO 3 CAUCIONADA 4 VINCULADA 8 COBRANÇA CONTA CAPITAL
quantidade

integer

(required) Quantidade mínima de nosso números que devem estar disponíveis na faixa a ser pesquisada.
numeroContratoCobranca

integer

Indicar o id do contatro de cobrança
