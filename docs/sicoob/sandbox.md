Sandbox

O ambiente de Sandbox foi criado especificamente para desenvolvedores que desejam testar as APIs do Sicoob. Esse ambiente é uma cópia do ambiente de produção, mas com a diferença de que os dados retornados são simulados (mocks). A documentação completa de todos os endpoints está disponível para consulta em nosso Catálogo de APIs.

Para começar a utilizar o ambiente de testes de nossas APIs, siga os passos:

1) Acesse suas credenciais de teste:
Antes de começar a utilizar o ambiente de sandbox, é necessário obter suas credenciais de teste. Elas estão disponíveis após o registro no nosso portal, em Sandbox. Vale ressaltar que esse Client ID não é válido para o ambiente de produção.

2) Autenticação:
É necessário fornecer no Header Authorization das requisições o Access token fornecido em Sandbox.

3) Endpoints:
Confira o endpoint da API que deseja testar.
Endereços de Sandbox

API Cobrança Bancária:
https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3

API Cobrança Bancária Pagamentos:
https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria-pagamentos/v3

API Conta Corrente:
https://sandbox.sicoob.com.br/sicoob/sandbox/conta-corrente/v4

API Convênios Pagamentos:
https://sandbox.sicoob.com.br/sicoob/sandbox/convenios-pagamentos/v2

API Investimentos - RDC:
https://sandbox.sicoob.com.br/sicoob/sandbox/investimentos/v2

API Open Finance - Iniciação de Pagamento:
https://sandbox.sicoob.com.br/sicoob/sandbox/payments/v2/itp

API Pix Pagamentos:
https://sandbox.sicoob.com.br/sicoob/sandbox/pix-pagamentos/v2

API Pix Recebimentos:
https://sandbox.sicoob.com.br/sicoob/sandbox/pix/api/v2

API Poupança:
https://sandbox.sicoob.com.br/sicoob/sandbox/poupanca/v3

API SPB Transferências:
https://sandbox.sicoob.com.br/sicoob/sandbox/spb/v2
Exemplos de requisição

Consultar Cobrança Imediata PIX

curl --location --request GET 'https://sandbox.sicoob.com.br/sicoob/sandbox/pix/api/v2/cob/:TXID' \
--header 'Authorization: Bearer {{Access Token}}' \
--header 'client_id: {{client_id}}' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json'

    Obs: O TXID é um path param que deve ser preenchido com o identificador único do QR Code. Ele deve conter de 27 a 36 caracteres.

Consultar Boleto

curl --location -g --request GET 'https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3/boletos?numeroContrato={{numContrato}}&modalidade=1&nossoNumero=integer' \
--header 'Authorization: Bearer {{Access Token}}' \
--header 'client_id: {{client_id}}' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json'

    Obs: Os Headers seguirão um padrão para todas as APIs.


## minhas credenciais
Sandbox

O ambiente de sandbox foi criado especificamente para desenvolvedores que desejam testar as APIs do Sicoob. Esse ambiente é uma cópia do ambiente de produção, mas com a diferença de que os dados retornados são simulados (mocks). A documentação completa de todos os endpoints está disponível para consulta em nosso Catálogo de APIs.
Client ID : 9b5e603e428cc477a2841e2683c92d21

Access token (Bearer): 1301865f-c6bc-38f3-9f49-666dbcfc59c3

## Endpoints
API Pix Recebimentos
https://sandbox.sicoob.com.br/sicoob/sandbox/pix/api/v2

API Cobrança Bancária Pagamentos
https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria-pagamentos/v3

API Cobrança Bancária
https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3

API Open Finance - Iniciação de Pagamento
https://sandbox.sicoob.com.br/sicoob/sandbox/payments/v2/itp

API Conta Corrente
https://sandbox.sicoob.com.br/sicoob/sandbox/conta-corrente/v4

API Convênios Pagamentos
https://sandbox.sicoob.com.br/sicoob/sandbox/convenios-pagamentos/v2

API Investimentos - RDC
https://sandbox.sicoob.com.br/sicoob/sandbox/investimentos/v2

API Pix Pagamentos
https://sandbox.sicoob.com.br/sicoob/sandbox/pix-pagamentos/v2

API Poupança
https://sandbox.sicoob.com.br/sicoob/sandbox/poupanca/v3

API SPB Transferências
https://sandbox.sicoob.com.br/sicoob/sandbox/spb/v2 