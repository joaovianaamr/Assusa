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
| [meta/](meta/) | Config do app WhatsApp Cloud API no painel da Meta: IDs, números cadastrados, permissões de App Review. |
| [sicoob/](sicoob/) | Contrato Node↔Python e referência da API bancária Sicoob (boleto, token, webhook). |

## Histórico (não é documentação viva)

| Doc | Quando ler |
|---|---|
| [prompts/](prompts/) | Prompts usados para pedir features específicas a um agente de IA — registro do que foi decidido, não guia de uso. |

---

`boleto.md`, se existir na sua cópia local, **não é versionado** (`.gitignore`) — tem CPF e
dados de boleto de teste, fica só na sua máquina.
