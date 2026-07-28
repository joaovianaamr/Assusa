# Sicoob — contrato e referência da API

| Ficheiro/pasta | Nota |
| -------------- | ---- |
| [NODE_PYTHON_CONTRACT.md](NODE_PYTHON_CONTRACT.md) | Contrato entre o Node (`services/sicoobClient.js`) e o microsserviço Python (`sicoob/`). |
| [dados-gerais.md](dados-gerais.md), [escopo.md](escopo.md), [sandbox.md](sandbox.md), [seguranca-geral.md](seguranca-geral.md), [time-span-limit.md](time-span-limit.md) | Referência geral da API Cobrança Bancária Sicoob (documentação externa, uso interno). |

## Endpoints — boleto

O fluxo do bot usa principalmente os dois primeiros.

| Endpoint | Doc |
| --- | --- |
| `GET` listar boletos por pagador | [get-listar-boletos-por-pagador.md](boleto/get-listar-boletos-por-pagador.md) |
| `GET` emitir segunda via | [get-emitir-segunda-via-boleto.md](boleto/get-emitir-segunda-via-boleto.md) |
| `GET` consultar boleto | [get-consultar-boleto.md](boleto/get-consultar-boleto.md) |
| `GET` faixa de nossos números disponíveis | [get-consulta-faixa-nossos-numeros-disponiveis.md](boleto/get-consulta-faixa-nossos-numeros-disponiveis.md) |
| `POST` incluir boleto | [post-incluir-boleto.md](boleto/post-incluir-boleto.md) |
| `PATCH` alterar dados do boleto | [patch-alterar-dados-boleto.md](boleto/patch-alterar-dados-boleto.md) |
| `POST` comandar baixa | [post-comandar-a-baixa-boletos.md](boleto/post-comandar-a-baixa-boletos.md) |

## Endpoints — token e webhook

| Endpoint | Doc |
| --- | --- |
| Geração/renovação de token | [token/tokens-sicoob.md](token/tokens-sicoob.md) |
| `POST` cadastrar webhook | [post-cadastrar-webhook.md](webhook/post-cadastrar-webhook.md) |
| `GET` consultar webhooks cadastrados | [get-consultar-os-webhooks-cadastrados.md](webhook/get-consultar-os-webhooks-cadastrados.md) |
| `GET` consultar solicitações de um webhook | [get-consultar-solicitações-de-um-webhook.md](webhook/get-consultar-solicitações-de-um-webhook.md) |
| `PATCH` alterar webhook | [patch-alterar-um-webhook-cadastrado.md](webhook/patch-alterar-um-webhook-cadastrado.md) |
| `PATCH` reativar webhook inativo | [patch-reativar-um-webhook-inativo.md](webhook/patch-reativar-um-webhook-inativo.md) |
| `DELETE` excluir webhook | [del-excluir-um-webhook.md](webhook/del-excluir-um-webhook.md) |
