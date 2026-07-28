# Referência — ativos da Meta (WhatsApp Cloud API)

Estado **atual** dos ativos. Toda linha desta página foi conferida por Graph API, não copiada
do painel. Ao mudar qualquer coisa aqui, reconfira com `scripts/meta-numero.sh listar`.

Histórico de como chegamos aqui: [historico-migracao-smb.md](historico-migracao-smb.md).
Como repetir o cadastro: [playbook-numero-novo.md](playbook-numero-novo.md).

## Onde ficam os identificadores

Os IDs e o PIN **não são versionados** — vivem no `.env` (fora do git, repositório público).
As chaves estão documentadas em [`.env.sample`](../../.env.sample).

| Variável | O que é |
| --- | --- |
| `APP_ID` | App "Assusa" no painel de desenvolvedores da Meta |
| `BUSINESS_ID` | Business "Assusa", dono de todas as WABAs |
| `WABA_ID` | WABA de **produção**, nativa Cloud API, criada em 27/07/2026 |
| `PHONE_NUMBER_ID` | Número em uso (+55 31 98427-1278) |
| `WHATSAPP_2FA_PIN` | **Segredo.** PIN de duas etapas; protege o re-registro do número |
| `WABA_ID_LEGADO` / `PHONE_NUMBER_ID_LEGADO` | WABA e número antigos, travados em `ON_PREMISE` |

Para ver os valores atuais e o estado real na Meta:

```bash
./scripts/meta-numero.sh listar     # todos os números da WABA de produção
./scripts/meta-numero.sh status     # detalhe do número em uso
```

## Estado dos ativos

Todas as WABAs: `ownership_type: SELF`, `account_review_status: APPROVED`,
`business_verification_status: verified`, sob o mesmo business.

| Número | Onde | Estado |
| --- | --- | --- |
| **+55 31 98427-1278** | WABA de produção (`WABA_ID`) | `CLOUD_API` / `CONNECTED` / `VERIFIED`, nome `APPROVED` — **em uso** |
| +1 555-647-1004 (teste Meta) | WABA `Waba-test` | `CLOUD_API` / `CONNECTED` |
| +55 31 3624-8550 (fixo) | WABA legado | `ON_PREMISE` / `DISCONNECTED` — **inutilizável**, ver histórico |

Dois detalhes de formatação que já causaram confusão:

- A Meta **exibe o celular sem o `9`** (`+55 31 8427-1278`). É normal no Brasil e não afeta nada.
- Para o **fixo**, o `9` não pode ser usado de forma alguma — são 8 dígitos. É linha fixa de BH,
  o que também explica por que `code_method: "SMS"` nunca funcionaria nele.

## Perfil de negócio (foto, descrição, site)

```bash
./scripts/meta-numero.sh perfil                 # lê o estado atual
./scripts/meta-numero.sh foto caminho/logo.png  # troca a foto
```

A foto **não vai direto no perfil**: precisa virar um `handle` pela Resumable Upload API antes
(`POST /{app-id}/uploads` → `POST /{upload-session-id}` → `POST /{phone-number-id}/whatsapp_business_profile`).
O script faz os três passos. Duas pegadinhas embutidas nele:

- O passo de envio dos bytes usa `Authorization: OAuth`, **não `Bearer`**. A Meta recusa `Bearer`
  nesse endpoint específico e o erro que devolve não menciona o esquema de autenticação.
- Requisitos da imagem: **quadrada**, mínimo 192×192, JPEG ou PNG, até 5 MB. Fora disso a Meta
  corta ou recusa. O script valida o tipo antes de gastar a chamada.

Alternativa sem terminal: WhatsApp Manager → **Configurações da conta do WhatsApp Business** →
**Perfil**. Mesmo resultado; a rota por API existe porque é reproduzível e versionável.

## Token

System user token, em `ACCESS_TOKEN` (`.env`, fora do git). `is_valid: true`, `expires_at: 0`
(não expira). Escopos:

```
whatsapp_business_management, whatsapp_business_messaging,
manage_app_solution, whatsapp_business_manage_events, public_profile
```

**Não tem `business_management`.** Consequência prática: não dá para listar as WABAs do business
(`/owned_whatsapp_business_accounts` → `(#200)`) nem ler campos administrativos da WABA. Isso é
esperado e não indica problema de vínculo — consultar a WABA pelo ID direto funciona.

**O app não é Business Solution Provider.** Logo `POST /{waba-id}/phone_numbers` (adicionar
número por API) nunca vai funcionar; número novo entra pelo painel. Ver playbook.

## Webhook

```
GET /{app-id}/subscriptions
→ whatsapp_business_account -> https://assusa.tech/webhook | active: true
```

Inclui o campo `messages`. A inscrição do app é **por WABA** — ver o passo 5 do playbook, que é
justamente o que o painel não faz sozinho.

## Cobrança

Meio de pagamento configurado no business: `MASTERCARD *8089`, expira em 5/2036.

## Segredos — onde NÃO guardar

PIN de verificação em duas etapas do número protege o re-registro em outra instância da Cloud
API. **Nunca versionar**: este repositório é público. Guarde no `.env` (ignorado por
`.gitignore:20`) ou num gerenciador de senhas.

## Permissões (App Review)

- [permissoes/whatsapp_business_management.md](permissoes/whatsapp_business_management.md)
- [permissoes/whatsapp_business_messaging.md](permissoes/whatsapp_business_messaging.md)

![Escopo do token](../capturas/meta/info/1785081947305.png)
