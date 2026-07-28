# Contrato HTTP: Node.js → serviço Python (boletos Sicoob)

## Transporte

- **Protocolo:** HTTP/1.1, JSON (`Content-Type: application/json` onde aplicável).
- **Base URL (dev):** `http://127.0.0.1:8090` (configurável por `SICOOB_SERVICE_URL` no Node).
- **Timeout recomendado no cliente Node:** 60 s (chamadas mTLS + Sicoob podem ser lentas).

## Autenticação interna

Todos os endpoints sob `/internal/*` exigem cabeçalho:

```http
X-Internal-Api-Key: <mesmo valor que INTERNAL_API_KEY no Python>
```

Respostas sem chave ou chave inválida: **401** JSON `{"detail":"Unauthorized"}`.

## Health

| Método | Caminho | Corpo | Sucesso |
|--------|---------|-------|---------|
| `GET` | `/health` | — | `200` `{"status":"ok"}` |

Não exige `X-Internal-Api-Key`.

## Boletos (cobrança v3)

Todas as rotas abaixo exigem `X-Internal-Api-Key`. O corpo de resposta é sempre JSON: envelope comum quando possível.

### Envelope de resposta

- **Sucesso operacional (cliente Sicoob devolveu payload):** `200` com `{"ok": true, "result": <objeto retornado pelo port PHP>}`.
- O campo `result` reproduz a estrutura do PHP (listas/dicionários), incluindo chaves como `status` + `response`, ou `error`, etc.

- **Erro de validação FastAPI:** `422` com detalhe padrão Pydantic.

- **Erro de campo obrigatório ausente:** HTTP `200` com `result.error` preenchido — o serviço
  não devolve 4xx nesse caso. Desde jul/2026 a mensagem lista **todos** os campos faltantes de
  uma vez:

  ```json
  { "ok": true, "result": { "error": "Campo(s) obrigatório(s) ausente(s): numeroCliente, codigoModalidade" } }
  ```

  > **Trate `error` pela presença, nunca pelo texto.** É o que o Node faz
  > (`api/infrastructure/sicoobHttp.js`, `api/application/consultarPorCpf.js`): testa se a chave
  > existe e não casa strings. O conteúdo já mudou uma vez e pode mudar de novo — as mensagens
  > são derivadas do nome da operação (`Falha ao dar baixa no boleto: ...`), então elas
  > acompanham qualquer renomeação interna.

- **Erro interno não tratado:** `500` `{"detail": "..."}`.

### Rotas

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `POST` | `/internal/boleto/registrar` | Corpo: objeto JSON igual ao array `$fields` do `registrarBoleto`. |
| `POST` | `/internal/boleto/segunda-via` | Corpo: parâmetros `numeroCliente`, `codigoModalidade`, e um de `nossoNumero` / `linhaDigitavel` / `codigoBarras`. |
| `POST` | `/internal/boleto/consultar` | Corpo: `numeroCliente`, `linhaDigitavel`, `codigoBarras`, `numeroContratoCobranca`. |
| `POST` | `/internal/boleto/baixa` | Corpo: `nossoNumero`, `numeroCliente`. |
| `POST` | `/internal/boleto/listar` | Corpo: `numeroCliente`, `dataInicio`, `dataFim`, `numeroCpfCnpj`. |
| `PATCH` | `/internal/boleto/alterar/{nosso_numero}` | Corpo: objeto `fields` do `alterarDadosBoleto`. |

### Webhooks cobrança v3

| Método | Caminho | Corpo / query |
|--------|---------|---------------|
| `POST` | `/internal/webhook/cadastrar` | JSON `fields`. |
| `GET` | `/internal/webhook/consultar?idWebhook=<id>` | Query obrigatória `idWebhook`. |
| `PATCH` | `/internal/webhook/{id_webhook}` | JSON `fields`. |
| `DELETE` | `/internal/webhook/{id_webhook}` | — |

## Variáveis de ambiente (Python)

Ver `README.md` na raiz do pacote `sicoob`.
