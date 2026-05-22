# request
curl --location -g 'https://api.sicoob.com.br/cobranca-bancaria/v3/boletos/pagadores/:numeroCpfCnpj?numeroContrato={{numContrato}}&numeroCliente=integer&dataInicio=2022-06-01&dataFim=2022-06-30' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json' \
--header 'client_id: {{clientid}}'

# response
{
  "resultado": [
    {
      "numeroCliente": 25546454,
      "codigoModalidade": 1,
      "numeroContaCorrente": 0,
      "codigoEspecieDocumento": "DM",
      "dataEmissao": "2018-09-20",
      "nossoNumero": 0,
      "seuNumero": "1235512",
      "identificacaoBoletoEmpresa": "4562",
      "codigoBarras": "",
      "linhaDigitavel": "",
      "valor": 156.23,
      "dataVencimento": "2018-09-20",
      "valorAbatimento": 1,
      "tipoDesconto": 0,
      "dataPrimeiroDesconto": "2018-09-20",
      "valorPrimeiroDesconto": 1,
      "dataSegundoDesconto": "2018-09-20",
      "valorSegundoDesconto": 0,
      "dataTerceiroDesconto": "2018-09-20",
      "valorTerceiroDesconto": 0,
      "tipoMulta": 1,
      "dataMulta": "2018-09-20",
      "valorMulta": 5,
      "tipoJurosMora": 1,
      "dataJurosMora": "2018-09-20",
      "valorJurosMora": 4,
      "numeroParcela": 1,
      "aceite": true,
      "codigoNegativacao": 2,
      "codigoProtesto": 1,
      "quantidadeDiasFloat": 2,
      "pagador": {
        "numeroCpfCnpj": "98765432185",
        "nome": "Marcelo dos Santos"
      },
      "beneficiarioFinal": {
        "nome": "Lucas de Lima"
      },
      "mensagensInstrucao": [
        "Descrição da Instrução 1",
        "Descrição da Instrução 2",
        "Descrição da Instrução 3",
        "Descrição da Instrução 4",
        "Descrição da Instrução 5"
      ],
      "situacaoBoleto": "Liquidado",
      "qrCode": "00020101021226950014br.gov.bcb.pix2573pix.sicoob.com.br/qr/payload/v2/cobv/e736df1b-1389-4b96-a070-c8dddac768de5204000053039865802BR5924JULIO PEREIRA DE OLIVEIRA6008Brasilia62070503***630435A3"
    }
  ]
}

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/pagadores/:numeroCpfCnpj/boletos?numeroCliente=integer&codigoSituação=integer&dataInicio=2022-06-01&dataFim=2022-06-30&numeroCpfCnpj=string

Serviço para listagem de boletos por Pagador.
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
numeroCliente

integer

(required) Número que identifica o contrato do beneficiário no Sisbr.
codigoSituação

integer

Código da Situação do Boleto.

1 Em Aberto 2 Baixado 3 Liquidado
dataInicio

2022-06-01

Data de Vencimento Inicial. yyyy-MM-dd
dataFim

2022-06-30

Data de Vencimento Final. yyyy-MM-dd
numeroCpfCnpj

string

(required)CPF ou CNPJ do pagador
PATH VARIABLES
numeroCpfCnpj

(required) CPF ou CNPJ do pagador. Tamanho máximo 14.