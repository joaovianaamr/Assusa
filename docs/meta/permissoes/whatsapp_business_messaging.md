# Descrição do negócio — whatsapp_business_messaging

**Campo a preencher no portal Meta (Uso permitido → whatsapp_business_messaging):**

> Somos a ASSUSA, associação que usa o WhatsApp Business para enviar e receber mensagens automatizadas, permitindo que associados solicitem e recebam a segunda via de boletos Sicoob diretamente pelo WhatsApp, com suporte de atendente humano quando necessário.

---

## Como esse app usa a permissão whatsapp_business_messaging?

O **bot-assusa-wpp** usa a permissão `whatsapp_business_messaging` para:

- **Receber mensagens dos associados** via webhook (POST da Meta no endpoint configurado), iniciando ou continuando o fluxo de solicitação de segunda via.
- **Enviar mensagens interativas** (listas, botões de resposta rápida) para guiar o associado pelo fluxo: identificação por CPF, seleção do boleto, confirmação e entrega da segunda via.
- **Enviar a segunda via em PDF ou link** gerado pelo back-end do Sicoob diretamente na conversa do WhatsApp.
- **Notificar o associado** sobre o status da solicitação (boleto encontrado, boleto não encontrado, erro de processamento) usando templates aprovados.
- **Transferir o atendimento** para um atendente humano quando o bot não consegue resolver a solicitação, mantendo o histórico da conversa.

Todas as mensagens são enviadas exclusivamente para usuários que iniciaram contato voluntariamente com o número da ASSUSA, em conformidade com as políticas de mensagens do WhatsApp Business.
