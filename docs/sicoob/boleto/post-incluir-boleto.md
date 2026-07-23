# HEADERS
Content-Type:   application/json
Authorization: Bearer {{token}}
Accept: application/json
client_id: {{client_id}}

# Body raw (json)

{
    "numeroCliente": 25546454,
    "codigoModalidade": 1,
    "numeroContaCorrente": 0,
    "codigoEspecieDocumento": "DM",
    "dataEmissao": "2018-09-20",
    "nossoNumero": 2588658,
    "seuNumero": "1235512",
    "identificacaoBoletoEmpresa": "4562",
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
    "gerarPdf": false,
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
    "codigoCadastrarPIX": 1,
    "numeroContratoCobranca": 1
}

# url
https://api.sicoob.com.br/cobranca-bancaria/v3/boletos

# descrição dos campos

## numero Cliente
Número que identifica o beneficiário na plataforma de atendimento da cooperativa.

## código modalidade
Identifica a modalidade do boleto.

    1 - SIMPLES COM REGISTRO

    3 - CAUCIONADA

    4 - VINCULADA

    5 - CARNÊ DE PAGAMENTOS

    6 - INDEXADA

    8 - COBRANÇA CONTA CAPITAL

## numero conta corrente
 Número da Conta Corrente onde será realizado o crédito da liquidação do boleto.

## especie documento
 Informar valores listados abaixo. Tamanho máximo 3 caracteres CH - Cheque DM - Duplicata Mercantil DMI - Duplicata Mercantil Indicação DS - Duplicata de Serviço DSI - Duplicata Serviço Indicação DR - Duplicata Rural LC - Letra de Câmbio NCC - Nota de Crédito Comercial NCE - Nota de Crédito Exportação NCI - Nota de Crédito Industrial NCR - Nota de Crédito Rural NP - Nota Promissória NPR - Nota Promissória Rural TM - Triplicata Mercantil TS - Triplicata de Serviço NS - Nota de Seguro RC - Recibo FAT - Fatura ND - Nota de Débito AP - Apólice de Seguro ME - Mensalidade Escolar PC - Pagamento de Consórcio NF - Nota Fiscal DD - Documento de Dívida CC - Cartão de Crédito BDP - Boleto Proposta OU - Outros

## data emissão
Data de emissão do boleto. Caso não seja informado, o sistema atribui a data de registro do boleto no Sisbr. Formato yyyy-mm-ddT00:00:00-03:00.

## Nosso Número: (optional) 
Número que identifica o boleto de cobrança no Sisbr. Caso deseje, o beneficiário poderá informar o nossoNumero seguindo a regra abaixo informada. Caso contrário, o sistema gerará automaticamente. Para informar o NossoNumero deverá ser calculado o Dígito Verificador.

Constante para cálculo = 3197

a) Concatenar na sequência completando com zero à esquerda.

Exemplo: Número da cooperativa: 0001 Número do cliente: 19 Nosso número: 21
Número da Cooperativa (4)	Número do Cliente (10)	Nosso número (7)
0001	0000000019	0000021

b) Alinhar a constante com a sequência repetindo de traz para frente. Exemplo: | 000100000000190000021 | | 319731973197319731973 |

c) Multiplicar cada componente da sequência com o seu correspondente da constante e somar os resultados. Exemplo: 1 * 7 + 1 * 3 + 9 * 1 + 2 * 7 + 1 * 3 = 36

d) Calcular o Resto através do Módulo 11. Exemplo: 36/11 = 3 resto = 3

e) O resto da divisão deverá ser subtraído de 11 achando assim o DV (Se o Resto for igual a 0 ou 1 então o DV é igual a 0). Exemplo: 11 – 3 = 8, então Nosso Número + DV = 21-8

## seu número
 Número identificador do boleto no sistema do beneficiário. Tamanho máximo 18

## identificação boleto empresas: (optional)
Campo destinado para uso da empresa do beneficiário para identificação do boleto. Tamanho máximo 25

## identificação emissão boleto
 Código de identificação de emissão do boleto. Informar os valores listados abaixo.

    1 - Banco Emite

    2 - Cliente Emite

## Identificação distribuição boleto
Código de identificação de distribuição do boleto. Informar os valores listados abaixo.

    1 - Banco Distribui

    2 - Cliente Distribui

## valor
valor nominal do boleto

## Valor 
Valor nominal do boleto.

## Data Vencimento
Data de vencimento do boleto. Formato yyyy-mm-dd.

## Data Limite Pagamento: (optional)
Data de limite para pagamento do boleto. Formato yyyy-mm-dd.

## Valor Abatimento: (optional)
Valor do abatimento a ser aplicado no boleto.

## Tipo Desconto: 
Informar o tipo de desconto atribuído ao boleto.

    0 - Sem Desconto

    1 - Valor Fixo Até a Data Informada

    2 -Percentual até a data informada

    3 - Valor por antecipação dia corrido

    4 - Valor por antecipação dia útil

    5 - Percentual por antecipação dia corrido

    6 - Percentual por antecipação dia útil

## Data Primeiro Desconto: (optional)
 Data do primeiro desconto. Formato yyyy-mm-dd.

## Valor Primeiro Desconto: (optional)
 Valor do primeiro desconto. Deve ser informado caso a data do primeiro desconto seja preenchida.

## Data Segundo Desconto: (optional)
 Data do segundo desconto. Formato yyyy-mm-dd.

## Valor Segundo Desconto: (optional)
 Valor do segundo desconto. Deve ser informado caso a data do segundo desconto seja preenchida.

## Data Terceiro Desconto: (optional)
 Data do terceiro desconto. Formato yyyy-mm-dd.

## Valor Terceiro Desconto: (optional)
 Valor do terceiro desconto. Deve ser preenchido caso a data do terceiro desconto seja preenchida.

## Tipo Multa:
 Tipo de multa a ser aplicado no boleto. Informar os valores listados abaixo.

    0 - Isento

    1 - Valor Fixo

    2 - Percentual

## Data Multa: (optional)
 Deve ser maior que a data de vencimento do boleto e menor ou igual que data limite de pagamento. Formato yyyy-mm-dd.

## Valor Multa: (optional)
 Valor da multa. Deve ser preenchido o campo Data Multa seja preenchido.

## Tipo Juros Mora:
 Tipo de juros de mora. Informar os valores listados abaixo.

    1 - Valor por dia

    2 - Taxa Mensal

    3 - Isento

## Data Juros Mora: (optional)
 Deve ser maior que a data de vencimento do boleto e menor ou igual que data limite de pagamento. Formato yyyy-mm-dd.

## Valor Juros Mora: (optional)
 Valor do juros de mora. Deve ser preenchido caso o campo dataJurosMora seja preenchido.

## Número Parcela:
 Número da parcela do boleto. Valor máximo permitido 99

## Aceite: (optional)
 Identificador do aceite do boleto.

## Código Negativação: (optional)
 Código de negativação do boleto. Informar os valores abaixo.

    2 - Negativar Dias Úteis

    3 - Não Negativar

## Número Dias Negativação: (optional)
 Número de dias para negativação do boleto. Deve ser preenchido caso o campo codigoNegativacao seja igual a ‘2’.

## Código Protesto: (optional)
 Código de protesto do boleto. Informar os valores abaixo.

    1 - Protestar Dias Corridos

    2 - Protestar Dias Úteis

    3 - Não Protestar

## Número Dias Protesto: (optional)
 Número de dias para protesto do boleto. Deve ser preenchido caso o campo codigoProtesto seja ‘1’.

# Pagador
Informar dados do pagador

Número Cpf/Cnpj: CPF ou CNPJ do pagador do boleto de cobrança. CNPJ: Tamanho máximo 14 CPF: Tamanho máximo 11

Nome: Nome completo do pagador do boleto de cobrança. Tamanho máximo 50

Endereço: Endereço do pagador do boleto de cobrança. Tamanho máximo 40

Bairro: Bairro do pagador do boleto de cobrança. Tamanho máximo 30

Cidade: Cidade do pagador do boleto de cobrança. Tamanho máximo 40

Cep: CEP do pagador. Tamanho máximo 8

UF: UF do pagador. Tamanho máximo 2

Email: string (optional)

# Beneficiário Final (optional)
Informar dados do beneficiário final

Número Cpf/Cnpj: (optional) CPF ou CNPJ do Beneficiário Final. Antigo Sacador Avalista. Tamanho máximo 14

Nome: (optional) Nome do Beneficiário Final. Antigo Sacador Avalista. Tamanho máximo 50

# Mensagens Instrução: (optional)
Lista de instruções. A lista de mensagem permite 5 mensagens com máximo de 40 caracteres.

Exemplo: [ "Descrição da Instrução 1", "Descrição da Instrução 2", "Descrição da Instrução 3", "Descrição da Instrução 4", "Descrição da Instrução 5" ]

# Rateio Crédito (optional)
Número Banco: Número do Banco de Destino

Número Agência: Número da Agência de Destino

Número Conta Corrente: Número da Conta Corrente Destino.

Conta Principal: Identificador de conta principal.

Código Tipo Valor Rateio: Tipo de valor do Rateio.

    1 - Percentual

Valor Rateio: Valor do rateio.

Código Tipo Cálculo Rateio: Tipo de cálculo do Rateio.

    1 - Valor Cobrado

Número Cpf/Cnpj Titular: CPF ou CNPJ do titular da conta. Tamanho máximo 14

Nome Titular: Nome completo do titular da conta. Tamanho máximo 50

Código Finalidade Ted: Código da Finalidade TED.

    1 - Pagamento de Impostos, Tributos e Taxas

    2 - Pagamento a Concessionárias de Serviço Público

    3 - Pagamentos de Dividendos

    4 - Pagamento de Salários

    5 - Pagamento de Fornecedores

    6 - Pagamento de Honorários

    7 - Pagamento de Aluguéis e Taxas de Condomínio

    8 - Pagamento de Duplicatas e Títulos

    9 - Pagamento de Mensalidade Escolar

    10 - Crédito em Conta …

    99999 - Outros

    Para mais informações acesse: https://www.bcb.gov.br/estabilidadefinanceira/comunicacaodados

Código Tipo Conta Destino Ted: Tipo de conta Finalidade TED. Tamanho máximo 2

    CC - Conta Corrente

    CD - Conta de Depósito

    CG - Conta garantida

Quantidade Dias Float: Quantidade de dias float (não informar caso dataFloatCredito for informado)

Data Float Crédito: (optional) Data do float (não informar junto caso quantidadeDiasFloat for informado)

Código Cadastrar PIX: (optional) Indicar uma das opções

    0 - Padrão

    1 - Com Pix

    2 - Sem Pix

A opção “0 – Padrão” irá obedecer ao cadastro do Beneficiário. Se for automático, será registrado no Pix, caso contrário não será.

Para habilitar essa funcionalidade do boleto híbrido é necessário que o cooperado entre em contato com a cooperativa que ele está cadastrado e solicite a habilitação em seu cadastro, na Plataforma Cobrança Bancária 3.0, por meio do seguinte caminho: Sisbr 2.0 → Cobrança Bancária 3.0 (Direcionamento para o Sisbr 3.0) → Beneficiário → Cadastro. Para isso, será necessária e obrigatória a criação prévia de uma chave aleatória Pix para o usuário (cedente).

numeroContratoCobranca: (optional)

Somente para cooperados que possuem mais de um contrato com a cooperativa.

OBS: Se um campo opcional não for utilizado, é necessário removê-lo do corpo da solicitação, pois não é permitido enviar um campo com valor nulo.
