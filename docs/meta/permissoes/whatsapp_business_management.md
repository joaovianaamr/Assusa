# Descrição do negócio — whatsapp_business_management

**Campo a preencher no portal Meta (Uso permitido → whatsapp_business_management):**

> Somos a ASSUSA, associação que utiliza o gerenciamento da conta WhatsApp Business para configurar e administrar templates de mensagem aprovados e o número de telefone comercial do bot de segunda via de boletos Sicoob, garantindo conformidade com as políticas da Meta e a continuidade do atendimento automatizado aos associados.

---

## Como esse app usa a permissão whatsapp_business_management?

O **bot-assusa-wpp** usa a permissão `whatsapp_business_management` para:

- **Gerenciar templates de mensagem** (criação, edição e aprovação de HSMs usados no fluxo de segunda via — ex.: notificações de boleto gerado, confirmação de solicitação).
- **Administrar o número de telefone** associado à conta WhatsApp Business da ASSUSA no painel da Meta.
- **Configurar o webhook** (URL de callback) e os campos de assinatura necessários para receber eventos da Cloud API.
- **Consultar o status da conta** (limites de envio, saúde do número, eventuais bloqueios) para garantir disponibilidade contínua do atendimento.

Essas ações são realizadas pelo administrador técnico da ASSUSA via chamadas à API de Gerenciamento do WhatsApp Business, não pelo usuário final.
