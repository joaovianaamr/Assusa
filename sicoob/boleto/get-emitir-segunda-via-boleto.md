# request
curl --location -g 'https://api.sicoob.com.br/cobranca-bancaria/v3/boletos/segunda-via?numeroCliente={{numeroCliente}}&codigoModalidade=integer&nossoNumero=integer&linhaDigitavel=string&codigoBarras=string&gerarPdf=boolean&numeroContratoCobranca=integer' \
--header 'Content-Type: application/json' \
--header 'client_id: {{clientid}}' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json'

# response
{
  "resultado": {
    "numeroCliente": 25546454,
    "codigoModalidade": 1,
    "codigoEspecieDocumento": "DM",
    "dataEmissao": "2018-09-20",
    "nossoNumero": 0,
    "seuNumero": "1235512",
    "codigoBarras": "",
    "linhaDigitavel": "",
    "valor": 156.23,
    "dataVencimento": "2018-09-20",
    "valorAbatimento": 1,
    "numeroParcela": 1,
    "aceite": true,
    "tipoMulta": 1,
    "valorMulta": 5.01,
    "tipoJurosMora": 1,
    "valorJurosMora": 4,
    "pagador": {
      "numeroCpfCnpj": "98765432185",
      "nome": "Marcelo dos Santos",
      "endereco": "Rua 87 Quadra 1 Lote 1 casa 1",
      "bairro": "Santa Rosa",
      "cidade": "Luziânia",
      "cep": "72320000",
      "uf": "DF",
      "email": "pagador@dominio.com.br"
    },
    "beneficiarioFinal": {
      "numeroCpfCnpj": "98784978699",
      "nome": "Lucas de Lima"
    },
    "mensagensInstrucao": [
      "Descrição da Instrução 1",
      "Descrição da Instrução 2",
      "Descrição da Instrução 3",
      "Descrição da Instrução 4",
      "Descrição da Instrução 5"
    ],
    "pdfBoleto": "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1hPYmplY3QvU3VidHlwZS9JbWFnZS9XaWR0aCA1Nzgv+PgolaVRleHQtNS41LjExCnN0YXJ0eHJlZgoyNzAxOQolJUVPRgo=",
    "qrCode": "00020101021226950014br.gov.bcb.pix2573pix.sicoob.com.br/qr/payload/v2/cobv/e736df1b-1389-4b96-a070-c8dddac768de5204000053039865802BR5924JULIO PEREIRA DE OLIVEIRA6008Brasilia62070503***630435A3"
  }
}

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/boletos/segunda-via?numeroCliente={{numeroCliente}}&codigoModalidade=integer&nossoNumero=integer&linhaDigitavel=string&codigoBarras=string&gerarPdf=boolean&numeroContratoCobranca=integer

Serviço para emissão da segunda via de boleto já registrado.

Utiliza as informações do beneficiário logado (número da cooperativa, número identificador do beneficiário e conta corrente), com a informação do identificador do boleto (nosso número), ou da linha digitável ou do código de barras.

Quando informados código de barras ou linha digitável, a pesquisa é realizada prioritariamente por estes parâmetros.
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

{{numeroCliente}}

(required) Número que identifica o contrato do beneficiário no Sisbr.
codigoModalidade

integer

(required) Identifica a modalidade do boleto.

1 - SIMPLES COM REGISTRO 3 - CAUCIONADA 4 - VINCULADA 5 - CARNÊ DE PAGAMENTOS 6 - INDEXADA 8 - COBRANÇA CONTA CAPITAL
nossoNumero

integer

Número identificador do boleto no Sisbr. Caso seja informado, não é necessário informar a linha digitável ou código de barras.
linhaDigitavel

string

Número da linha digitável do boleto com 47 posições.Caso seja informado, não é necessário informar o nosso número ou código de barras.
codigoBarras

string

Número de código de barras do boleto com 44 posições.Caso seja informado, não é necessário informar o nosso número ou a linha digitável.
gerarPdf

boolean

Identificador para o sistema devolver ou não o PDF do Boleto. O PDF será retornado na Base64.
numeroContratoCobranca

integer

Indicar o id do contatro de cobrança