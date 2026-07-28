# Playbook — colocar um número novo na Cloud API

Receita testada de ponta a ponta em 27/07/2026, que levou o `+55 31 98427-1278` de chip virgem
a número operacional na primeira tentativa. Siga na ordem: cada passo existe porque pular ele
custou tempo antes.

Estado atual dos ativos: [referencia.md](referencia.md).
Por que o caminho é este e não outro: [historico-migracao-smb.md](historico-migracao-smb.md).

---

## Regra de ouro

> **Nunca instale WhatsApp nem WhatsApp Business no chip.**

Um número que já teve WhatsApp entra como `platform_type: ON_PREMISE` (SMB), e a partir daí
`/register` e `request_code` param de funcionar — foi exatamente assim que o número fixo da
ASSUSA ficou permanentemente travado. Número virgem entra direto como `CLOUD_API`.

---

## Passo 1 — confirmar que o número é virgem

Chip pré-pago costuma ser reciclado e pode carregar a conta do dono anterior. Dois testes,
faça os dois (o primeiro sozinho dá falso negativo por cache de contatos):

1. Salve o número nos contatos, atualize a lista do WhatsApp. Deve aparecer só **"Convidar"**.
2. Abra `https://wa.me/55DDDNUMERO`. Deve dizer que o número **não está no WhatsApp**.

**Se tiver conta ativa:** instale o WhatsApp comum, entre com o SMS, vá em Configurações → Conta
→ **Apagar minha conta**, desinstale, e só então prossiga.

**Preferência de tipo de linha:** use **celular**. Linha fixa recebe código só por chamada de voz
(`code_method: "VOICE"`), com alguém ao lado do aparelho, e o formato do número muda (sem o `9`).

---

## Passo 2 — criar uma WABA nativa de Cloud API

Configurações do Negócio → **Contas do WhatsApp** → botão **Adicionar**:

![Menu Adicionar, com as três opções](../capturas/meta/cadastro/1785201332105.png)

Escolha **"Crie uma nova conta do WhatsApp Business"**.

**Não escolha "Vincular uma conta do WhatsApp Business".** Esse é o fluxo de migração SMB e exige
que o número *já tenha* conta no app WhatsApp Business — com número virgem ele recusa, corretamente:

![Erro do fluxo Vincular com número virgem](../capturas/meta/cadastro/1785201286597.png)

**Por que uma WABA nova, e não a existente:** a WABA antiga é do tipo *"Aplicativo WhatsApp
Business"* (nasceu vinculada ao app SMB) e não oferece adição de número Cloud API. No print acima
esse rótulo aparece logo abaixo de "Propriedade de: Assusa".

Criada, ela entra em análise de conformidade — normalmente não bloqueia os passos seguintes:

![Confirmação de criação da WABA](../capturas/meta/cadastro/1785201799935.png)

Anote o **ID da WABA** (aparece como "Identificação:" no topo).

---

## Passo 3 — dar acesso do system user à WABA nova

A WABA nasce **sem vínculo com o seu app**, então o `ACCESS_TOKEN` do `.env` simplesmente não a
enxerga.

WABA nova → **Atribuir pessoas** (ou Configurações do Negócio → Usuários do sistema → o usuário
do app → Adicionar ativos) → selecione a WABA → **Controle total**.

![WABA nova: o ID fica no topo em "Identificação", e as abas Atribuir pessoas / Phone numbers são os dois próximos passos](../capturas/meta/cadastro/1785201905228.png)

Confira antes de seguir — se este comando responder, o acesso está OK:

```bash
./scripts/meta-numero.sh listar   # ajuste WABA_ID no script ou exporte WABA_ID=<id>
```

Pular este passo faz os passos seguintes falharem com erro de permissão que *parece* outra coisa.

---

## Passo 4 — adicionar o número pelo painel

> **Por API não funciona.** `POST /{waba-id}/phone_numbers` exige que o business dono do app seja
> Business Solution Provider. Sem isso a Meta devolve `200000 / 3095008`
> ("Cannot add phone number to WhatsApp Business Account"), que não explica nada — a causa real só
> aparece como `(#10) ... requires that the Business that owns this App is a Business Solution
> Provider` ao tocar em campos restritos da WABA.

WABA nova → aba **Phone numbers** → **Adicionar telefone**:

| Campo | Valor |
| --- | --- |
| Nome de exibição | `Assusa` |
| Categoria | Finanças (ou Serviços profissionais) |
| Descrição | `Atendimento automatizado para emissão de segunda via de boletos.` |
| Site | **deixe em branco** |
| Número | Brasil +55, DDD + 9 dígitos |
| Verificação | **SMS** |

Sobre os campos:

- **Nome de exibição** (`verified_name`) passa por análise da Meta e **mudar depois exige nova
  análise** — acerte de primeira. Com o business já `verified`, o nome da empresa aprova rápido.
- O **perfil** (categoria, descrição, endereço, foto) é cosmético e editável a qualquer momento,
  inclusive por API: `POST /{phone-number-id}/whatsapp_business_profile`.
- **Site em branco:** `assusa.tech` é o servidor do bot e responde JSON cru — péssima impressão
  para o cliente e exposição desnecessária do webhook. Preencha só quando houver site institucional.
- O **PIN de duas etapas** é escolhido aqui. **Não versione esse PIN** — repositório público.

Resultado esperado:

![Número conectado e nome de exibição aprovado](../capturas/meta/cadastro/1785202018752.png)

---

## Passo 5 — inscrever o app no webhook da WABA

**O painel não faz isso sozinho.** A WABA nova nasce com `subscribed_apps` vazio e, sem a
inscrição, nenhum evento chega ao webhook — o número fica conectado e o bot fica mudo.

```bash
curl -X POST "https://graph.facebook.com/v25.0/<WABA_ID>/subscribed_apps" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# → {"success": true}
```

Confirme:

```bash
curl -s "https://graph.facebook.com/v25.0/<WABA_ID>/subscribed_apps?access_token=$ACCESS_TOKEN"
```

---

## Passo 6 — verificar tudo

```bash
./scripts/meta-numero.sh status <phone-number-id>
```

Esperado:

```
platform_type: CLOUD_API
status: CONNECTED
code_verification_status: VERIFIED
name_status: APPROVED
```

E a configuração de webhook do app:

```
GET /{app-id}/subscriptions
→ whatsapp_business_account -> https://assusa.tech/webhook | active: true  (com o campo `messages`)
```

**Nenhuma mudança de código é necessária.** O bot lê o `phone_number_id` do payload do webhook
(`app.js:112`), então passa a responder pelo número novo assim que ele estiver conectado e inscrito.

Teste final: mande uma mensagem de WhatsApp para o número, de outro celular.

---

## Se algo falhar

A Meta erra o diagnóstico com frequência neste fluxo — mensagens de erro estruturais aparecem
disfarçadas de problema transitório, e a IA do painel repetiu isso cinco vezes seguidas em jul/2026.

**Antes de agir sobre qualquer erro, confirme por Graph API.** A tabela de diagnósticos falsos e
o que cada um realmente significava está no fim de
[historico-migracao-smb.md](historico-migracao-smb.md).

**Cuidado com tentativas de código.** Painel e API compartilham o mesmo contador de rate limit, e
cada disparo pode renovar o cooldown. Se um código falhar, **pare** — leia o erro, espere, e faça
uma única nova tentativa. Não repita às cegas.
