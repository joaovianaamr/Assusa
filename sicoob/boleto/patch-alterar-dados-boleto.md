# request
curl --location --request PATCH 'https://api.sicoob.com.br/cobranca-bancaria/v3/boletos/:nossoNumero' \
--header 'Content-Type: application/json' \
--header 'client_id: {{clientid}}' \
--header 'Authorization: Bearer {{token}}' \
--header 'Accept: application/json' \
--data '@'

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/boletos/:nossoNumero

Serviço para alteração de dados de boleto já registrado. Deve ser feita a alteração de somente um objeto do boleto por requisição.
Objetos de alteração do boleto:

    seuNumero

    desconto

    abatimento

    multa

    jurosMora

    rateioCredito

    pix

    prorrogacaoVencimento

    prorrogacaoLimitePagamento

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
# Bodyraw
 {
    "numeroCliente": 25546454,
    "codigoModalidade": 1,
    "especieDocumento": {
        "codigoEspecieDocumento": "DM"
    },
    "seuNumero": {
        "seuNumero": "209",
        "identificacaoBoletoEmpresa": "209"
    },
    "desconto": {
        "tipoDesconto": 1,
        "dataPrimeiroDesconto": "2018-09-20",
        "valorPrimeiroDesconto": 1,
        "dataSegundoDesconto": "2018-09-20",
        "valorSegundoDesconto": 0,
        "dataTerceiroDesconto": "2018-09-20",
        "valorTerceiroDesconto": 0
    },
    "abatimento": {
        "valorAbatimento": 156.23
    },
    "multa": {
        "tipoMulta": 1,
        "dataMulta": "2018-09-20",
        "valorMulta": 5
    },
    "jurosMora": {
        "tipoJurosMora": 1,
        "dataJurosMora": "2018-09-20",
        "valorJurosMora": 4
    },
    "rateioCredito": {
        "tipoOperacao": 2,
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
        ]
    },
    "pix": {
        "utilizarPix": false
    },
    "prorrogacaoVencimento": {
        "dataVencimento": "2018-09-20"
    },
    "prorrogacaoLimitePagamento": {
        "dataLimitePagamento": "2018-09-20"
    },
    "valorNominal": {
        "valor": 156.23
    }
}