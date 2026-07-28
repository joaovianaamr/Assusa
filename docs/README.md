# Documentação

Ponto de entrada. Cada seção abaixo tem um README/índice próprio quando é uma pasta —
comece por ele, não pelos arquivos soltos dentro.

## Entender o projeto

| Doc | Quando ler |
|---|---|
| [project-context.md](project-context.md) | Primeiro contato: o que é o bot, glossário do domínio (ASSUSA, segunda via, Cloud API), variáveis de ambiente por categoria. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Mapa de pastas/arquivos, como o Node inicializa, e como Node e o microsserviço Python se falam. |
| [fluxo-mensagens.md](fluxo-mensagens.md) | Máquina de estados do bot — cada caminho possível de conversa no WhatsApp, estado a estado. |

## Operar em produção

| Doc | Quando ler |
|---|---|
| [PRODUCAO.md](PRODUCAO.md) | Checklist de produção: bloqueadores, hardening pendente, backups. |
| [deploy.md](deploy.md) | Como o CI/CD funciona (todo push em `main` testa e deploya sozinho), secrets, rotação de chave, rollback, troubleshooting. |

## Testar sem WhatsApp de verdade

| Doc | Quando ler |
|---|---|
| [postman/](postman/) | Collection + guia para simular qualquer mensagem/estado via HTTP, sem celular. |

## Integrações externas (referência)

| Doc | Quando ler |
|---|---|
| [meta/](meta/) | Config do app WhatsApp Cloud API no painel da Meta: IDs e estado dos ativos, playbook de cadastro de número, histórico da migração SMB, App Review. |
| [sicoob/](sicoob/) | Contrato Node↔Python e referência da API bancária Sicoob (boleto, token, webhook). |

## Histórico (não é documentação viva)

| Doc | Quando ler |
|---|---|
| [meta/historico-migracao-smb.md](meta/historico-migracao-smb.md) | Investigação de jul/2026 sobre o número fixo travado em `ON_PREMISE`, e a tabela de diagnósticos falsos da Meta. |
| [prompts/](prompts/) | Prompts usados para pedir features específicas a um agente de IA — registro do que foi decidido, não guia de uso. |

## Material não versionado

| Doc | Quando ler |
|---|---|
| [capturas.md](capturas.md) | Onde ficam os prints e gravações (`docs/capturas/`), por que estão fora do git, e **por que isso significa que não têm backup**. |

---

Dois conteúdos existem só na sua máquina, por conterem dados sensíveis (`.gitignore`):

- `boleto.md` — CPF e dados de boleto de teste.
- `capturas/` — prints com IDs de conta, meio de pagamento, PINs e fragmentos de token.
