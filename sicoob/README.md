# sicoob-service (Python)

Microsserviço **FastAPI** que expõe endpoints **internos** para o serviço **Node.js** chamar a API **Sicoob** (cobrança bancária v3: boletos e webhooks de cobrança). A lógica de cliente foi portada da biblioteca PHP [**divulgueregional/api-sicoob**](https://github.com/divulgueregional/api-sicoob) (MIT).

## Atribuição

Este código deriva do trabalho de **Roseno Matos** / projeto [api-sicoob](https://github.com/divulgueregional/api-sicoob). Consulte a licença MIT do repositório original e mantenha a atribuição exigida pelo autor.

## Instalação (desenvolvimento)

```bash
cd sicoob
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
pytest
```

## Execução

```bash
export INTERNAL_API_KEY="uma-chave-secreta-partilhada-com-o-node"
export SICOOB_SANDBOX=true
export SICOOB_CERT_PATH=/caminho/cert.pem
export SICOOB_KEY_PATH=/caminho/key.pem
# ou PKCS#12:
# export SICOOB_P12_PATH=/caminho/cert.p12
# export SICOOB_P12_PASSWORD=...

uvicorn sicoob_service.app:app --host 0.0.0.0 --port 8090
```

Ou, após `pip install -e .`:

```bash
sicoob-service
```

Variáveis: ver `src/sicoob_service/settings.py`. Contrato HTTP com o Node: [docs/sicoob/NODE_PYTHON_CONTRACT.md](../docs/sicoob/NODE_PYTHON_CONTRACT.md).

## Estrutura

```
src/sicoob_service/
  app.py                rotas FastAPI, auth por header, ciclo de vida
  bootstrap.py          monta o cliente a partir de settings + certificados
  settings.py           pydantic-settings
  banking_v3.py         cliente da API de cobrança do Sicoob
  token_v3.py           OAuth + mTLS
  certificate_tools.py  extrai cert/key do .pfx
  database.py           pool psycopg2 (tabela de interações)
tests/                  suíte automatizada (pytest)
scripts/                utilitários manuais — não são testes
```

**Não há `domain/` nem `application/` aqui, e é de propósito.** Diferente do componente `api/`,
este serviço é um *gateway*: traduz HTTP interno → API do Sicoob e devolve. Toda regra de
negócio vive no Node (quais janelas buscar, como distinguir "cliente em dia" de "CPF não
cadastrado", quando usar lista em vez de botões). Criar camadas aqui produziria pastas vazias.

## Três decisões que parecem erro e não são

### 1. As rotas são `def`, não `async def`

O cliente (`banking_v3.py`) é **síncrono**: usa `httpx.Client` e chega a chamar `time.sleep()`
no retry de 429. Numa rota `async def`, isso roda dentro do event loop e bloqueia o servidor
inteiro. Declarando `def`, o FastAPI executa num threadpool e a concorrência volta.

Medido contra o serviço no ar, 6 requisições simultâneas a `/internal/boleto/listar` — que é
exatamente o que o Node dispara (`SICOOB_NUM_JANELAS=6`):

| | 6 em paralelo | 1 sozinha |
|---|---|---|
| rotas `async def` | **0,721 s** (a soma) | 0,087 s |
| rotas `def` | **0,096 s** (o máximo) | 0,090 s |

Vale também para `banking_dependency`, que renova o token via handshake mTLS — o ponto mais
caro de todos. **Trocar de volta para `async def` reintroduz a serialização em silêncio**: nada
falha, tudo só fica ~7× mais lento sob carga.

Migrar para `httpx.AsyncClient` seria a alternativa idiomática, e continua em aberto — exige
reescrever `banking_v3.py` e `token_v3.py` inteiros.

### 2. O tratamento de erro vem de um decorator

`@_chamada_sicoob("dar baixa no boleto")` embrulha cada método público. Antes eram 13 blocos
`try/except` copiados — e a cópia escondia um bug: `baixa_boleto`, `listar_boleto` e
`consultar_webhook` devolviam *"Falha ao consultar Boleto Cobranca"*, texto herdado de
`consultar_boleto`. Quem falhava ao **dar baixa** lia que a **consulta** falhou.

Com a mensagem derivada do nome da operação, herdar o texto de outro método deixou de ser
possível. `TestMensagemDeErroPorOperacao` trava isso.

### 3. Campos obrigatórios via `_exigir`

`_exigir(params, "numeroCliente", "codigoModalidade")` substituiu 31 checagens manuais. Além de
encurtar, mudou o retorno: antes cada chamada revelava **um** campo faltante, e o cliente
descobria os demais um a um. Agora vêm todos juntos:

```json
{"error": "Campo(s) obrigatório(s) ausente(s): numeroCliente, codigoModalidade"}
```

> O **texto** dessa mensagem mudou em jul/2026. É seguro porque o Node testa apenas a
> *presença* de `.error`, nunca o conteúdo (`api/infrastructure/sicoobHttp.js`,
> `api/application/consultarPorCpf.js`) — mas quem for consumir este serviço de outro lugar
> deve fazer o mesmo, e não casar strings.

## Código fonte PHP original

O port baseia-se em `src/` do repositório [api-sicoob](https://github.com/divulgueregional/api-sicoob) (fixar tag/commit no teu processo de release quando precisares de auditoria).
