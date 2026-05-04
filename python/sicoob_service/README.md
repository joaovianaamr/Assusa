# sicoob-service (Python)

Microsserviço **FastAPI** que expõe endpoints **internos** para o serviço **Node.js** chamar a API **Sicoob** (cobrança bancária v3: boletos e webhooks de cobrança). A lógica de cliente foi portada da biblioteca PHP [**divulgueregional/api-sicoob**](https://github.com/divulgueregional/api-sicoob) (MIT).

## Atribuição

Este código deriva do trabalho de **Roseno Matos** / projeto [api-sicoob](https://github.com/divulgueregional/api-sicoob). Consulte a licença MIT do repositório original e mantenha a atribuição exigida pelo autor.

## Instalação (desenvolvimento)

```bash
cd python/sicoob_service
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

Variáveis: ver `src/sicoob_service/settings.py`. Contrato HTTP com o Node: [docs/NODE_PYTHON_CONTRACT.md](../../docs/NODE_PYTHON_CONTRACT.md).

## Código fonte PHP original

O port baseia-se em `src/` do repositório [api-sicoob](https://github.com/divulgueregional/api-sicoob) (fixar tag/commit no teu processo de release quando precisares de auditoria).
