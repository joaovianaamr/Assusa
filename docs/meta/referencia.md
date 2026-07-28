# Referência — ativos da Meta (WhatsApp Cloud API)

Estado **atual** dos ativos. Toda linha desta página foi conferida por Graph API, não copiada
do painel. Ao mudar qualquer coisa aqui, reconfira com `scripts/meta-numero.sh listar`.

Histórico de como chegamos aqui: [historico-migracao-smb.md](historico-migracao-smb.md).
Como repetir o cadastro: [playbook-numero-novo.md](playbook-numero-novo.md).

## Identificadores fixos

| Ativo | ID |
| --- | --- |
| App ID | `3022736628114151` ("Assusa") |
| Business ID | `1269589111675253` ("Assusa") |
| System user do token | `122122968651220838` ("Assusa") |

## WABAs

| WABA | ID | Tipo | Uso |
| --- | --- | --- | --- |
| **Assusa** (nova) | `2109652016644520` | Cloud API nativa | **Produção.** Criada em 27/07/2026. |
| Waba-test | `2243287776413548` | Cloud API nativa | Número de teste da Meta. |
| Assusa (antiga) | `368840660673690` | Derivada do app SMB | Legado. Hospeda o fixo travado. |

Todas: `ownership_type: SELF`, `account_review_status: APPROVED`,
`business_verification_status: verified`, donas do business `1269589111675253`.

## Números

| Número | `phone_number_id` | WABA | Estado |
| --- | --- | --- | --- |
| **+55 31 98427-1278** | `1164007100138609` | `2109652016644520` | `CLOUD_API` / `CONNECTED` / `VERIFIED`, nome `APPROVED` — **em uso** |
| +1 555-647-1004 (teste Meta) | `1170317646154505` | `2243287776413548` | `CLOUD_API` / `CONNECTED` |
| +55 31 3624-8550 (fixo) | `3009766265732489` | `368840660673690` | `ON_PREMISE` / `DISCONNECTED` — **inutilizável**, ver histórico |

Dois detalhes de formatação que já causaram confusão:

- A Meta **exibe o celular sem o `9`** (`+55 31 8427-1278`). É normal no Brasil e não afeta nada.
- Para o **fixo**, o `9` não pode ser usado de forma alguma — são 8 dígitos. É linha fixa de BH,
  o que também explica por que `code_method: "SMS"` nunca funcionaria nele.

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
