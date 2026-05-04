# Contexto do projeto

## Visão geral

Bot de atendimento no **WhatsApp** (via **Cloud API** da Meta) que atende solicitações de **segunda via** no contexto da **ASSUSA**. O processamento da segunda via ocorre no **back-end do Sicoob**, acessado por este serviço mediante **chamadas HTTP** (cliente REST ou equivalente); o bot orquestra o diálogo no WhatsApp e dispara essas requisições quando for preciso emitir ou consultar segunda via.

A comunicação entre o WhatsApp e o serviço do bot é feita por **webhook** (HTTPS): a Meta envia eventos e mensagens recebidas para uma URL configurada na aplicação; respostas e envios de mensagem usam a API REST da Cloud API.

## Base de código (WhatsApp / Meta)

A implementação de referência na raiz deste repositório partiu do exemplo oficial **Jasper's Market** da Meta ([fbsamples/whatsapp-business-jaspers-market](https://github.com/fbsamples/whatsapp-business-jaspers-market)): Node.js, webhook em `/webhook`, Redis e fluxo documentado no `README.md` do projeto. Licença do trecho original: **Apache 2.0** (ver `LICENSE`). Evoluções específicas da ASSUSA/Sicoob devem respeitar essa origem e as [condições de uso](https://opensource.facebook.com/legal/terms) do sample, quando aplicável.

## Arquitetura (resumo)

| Camada | Papel |
|--------|--------|
| **WhatsApp Cloud API** | Canal com o usuário; webhooks de entrada; envio de mensagens/mídia. |
| **Webhook (este serviço)** | Valida assinatura/verificação, interpreta payloads, aplica regras de conversa e, quando necessário, **chama o Sicoob por HTTP**. |
| **Back-end Sicoob** | Origem da lógica e dos dados de **segunda via** (boletos, carnês ou equivalente contratado), exposto ao credenciado via **endpoints HTTP**. |

Fluxo típico: usuário envia mensagem no WhatsApp → Meta POST no webhook → serviço valida e processa → **requisições HTTP ao Sicoob** (consulta/emissão) → devolve resultado ao usuário pela Cloud API.

## Objetivos

- Receber e responder mensagens de forma confiável via webhook (incluindo verificação do endpoint e tratamento de retries da Meta).
- Integrar com o back-end de segunda via do **Sicoob** por **chamadas HTTP** (timeouts, retries e tratamento de erros conforme o contrato da API), sem duplicar regras de negócio que já existem lá.
- Manter rastreabilidade e segurança (tokens, segredo do webhook, dados sensíveis do cooperado).

## Stack e estrutura

- **Canal:** [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/) (Meta).
- **Entrada:** HTTP **webhook** (GET para verificação do callback URL; POST para notificações).
- **Negócio de segunda via:** integração com o **Sicoob** exclusivamente via **chamadas HTTP** aos endpoints contratados (métodos, headers, corpo e autenticação conforme documentação disponibilizada ao credenciado).
- **Código base:** Node.js conforme o sample Jasper's Market (`app.js`, `services/`, `package.json`).

## Variáveis de ambiente

Documentar chaves necessárias (sem colar segredos no repositório):

| Variável | Uso |
|----------|-----|
| Token / credenciais Cloud API | Autenticação nas chamadas à Meta para enviar mensagens. |
| `VERIFY_TOKEN` (ou equivalente) | Coincidir com o valor configurado no app Meta para validação GET do webhook. |
| Segredo do app / validação de assinatura | Conferir `X-Hub-Signature-256` nos POST do webhook, quando aplicável. |
| URL base / credenciais Sicoob | Base URL e credenciais das **chamadas HTTP** ao back-end de segunda via (homologação/produção). |

Variáveis do sample Meta: ver `.sample.env` e README.

## Glossário

- **Cloud API:** API oficial do WhatsApp hospedada na infraestrutura da Meta (não confundir com BSP on-prem legado, salvo se o projeto migrar).
- **Segunda via:** nova emissão ou reimpressão de boleto/carnê conforme regras do produto Sicoob.
- **ASSUSA:** instituição ou marca atendida por este fluxo.
- **Webhook:** endpoint HTTPS que recebe notificações assíncronas da Meta (mensagens, status de entrega, etc.).
- **Sicoob (integração):** o serviço do bot consome o back-end do Sicoob por **chamadas HTTP** iniciadas pelo próprio bot (request/response), em contraste com o webhook, que é entrada vinda da Meta.

## Notas

- Manter [project-context.md](project-context.md) (nesta pasta `docs/meta/`) alinhado a mudanças de escopo, versão da API do WhatsApp ou do contrato com o Sicoob.
- Tratar idempotência e duplicidade de eventos do webhook (a Meta pode reenviar o mesmo evento).
- O `origin` do Git pode ainda apontar para o repositório da Meta; ao publicar o projeto da ASSUSA, configure o remoto para o seu próprio repositório.
