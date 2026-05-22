# request
curl --location -g 'https://api.sicoob.com.br/cobranca-bancaria/v3/boletos?numeroCliente={{numCliente}}&codigoModalidade={{codigoModalidade}}&linhaDigitavel=string&codigoBarras=string&nossoNumero=integer&numeroContratoCobranca=integer' \
--header 'Authorization: Bearer {{token}}' \
--header 'accept: application/json' \
--header 'client_id: {{clientid}}'

# 200 ok
 {
  "resultado": {
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
    "identificacaoEmissaoBoleto": 1,
    "identificacaoDistribuicaoBoleto": 1,
    "valor": 156.23,
    "dataVencimento": "2018-09-20",
    "dataLimitePagamento": "2018-09-20",
    "valorAbatimento": 1,
    "tipoDesconto": 1,
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
    "numeroDiasNegativacao": 60,
    "codigoProtesto": 1,
    "numeroDiasProtesto": 30,
    "quantidadeDiasFloat": 2,
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
    "listaHistorico": [
      {
        "dataHistorico": "2019-05-31",
        "tipoHistorico": "1",
        "descricaoHistorico": "TARIFA - TAR. MANUTENÇÃO DE TÍTULO VENCIDO - R$ 0,75"
      }
    ],
    "situacaoBoleto": "Em Aberto",
    "rateioCreditos": [
      {
        "numeroBanco": 756,
        "numeroAgencia": 4027,
        "numeroContaCorrente": 0,
        "contaPrincipal": true,
        "codigoTipoValorRateio": 1,
        "valorRateio": 100,
        "codigoTipoCalculoRateio": 1,
        "numeroCpfCnpjTitular": "98765432185",
        "nomeTitular": "Marcelo dos Santos",
        "codigoFinalidadeTed": 10,
        "codigoTipoContaDestinoTed": "CC",
        "quantidadeDiasFloat": 1,
        "dataFloatCredito": "2020-12-30"
      }
    ],
    "qrCode": "00020101021226950014br.gov.bcb.pix2573pix.sicoob.com.br/qr/payload/v2/cobv/e736df1b-1389-4b96-a070-c8dddac768de5204000053039865802BR5924JULIO PEREIRA DE OLIVEIRA6008Brasilia62070503***630435A3"
  }
}

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/boletos?numeroCliente={{numCliente}}&codigoModalidade={{codigoModalidade}}&linhaDigitavel=string&codigoBarras=string&nossoNumero=integer&numeroContratoCobranca=integer

Serviço para consulta de um boleto bancário. Utiliza as informações do beneficiário logado (número da cooperativa, número identificador do beneficiário e conta corrente), com a informação do identificador do boleto (nosso número), ou da linha digitável ou do código de barras.

Identificação dos "tipoHistorico" do array "listaHistorico":

1 - ENTRADA
2 - ALTERAÇÃO
3 - PRORROGAÇÃO
4 - TARIFAS
5 - PROTESTO
6 - LIQUIDAÇÃO ou BAIXA.
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

{{numCliente}}

Número que identifica o contrato do beneficiário no Sisbr.
codigoModalidade

{{codigoModalidade}}

Identifica a modalidade do boleto.

1 - SIMPLES COM REGISTRO 3 - CAUCIONADA 4 - VINCULADA 5 - CARNÊ DE PAGAMENTOS 6 - INDEXADA 8 - COBRANÇA CONTA CAPITAL
linhaDigitavel

string

Número da linha digitável do boleto com 47 posições. Caso seja informado, não é necessário informar o nosso número ou código de barras.
codigoBarras

string

Número de código de barras do boleto com 44 posições.Caso seja informado, não é necessário informar o nosso número ou linha digitável.
nossoNumero

integer

Número identificador do boleto no Sisbr. Caso seja infomado, não é necessário infomar a linha digitável ou código de barras.
numeroContratoCobranca

integer

Indicar o id do contatro de cobrança