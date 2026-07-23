# Configuração do app na Meta (WhatsApp Cloud API)

Referência de configuração do app/WABA no painel da Meta — não faz parte do runtime.

| Ficheiro | Nota |
| -------- | ---- |
| [info.md](info.md) | IDs de App/Business/WABA, números cadastrados, diagnóstico e migração SMB → Cloud API. |
| [permissoes/whatsapp_business_management.md](permissoes/whatsapp_business_management.md) | Justificativa de uso da permissão (App Review). |
| [permissoes/whatsapp_business_messaging.md](permissoes/whatsapp_business_messaging.md) | Justificativa de uso da permissão (App Review). |

`image/` guarda os prints usados em `info.md` — **fora do git** (`.gitignore`), porque alguns
comandos curl exibidos no painel mostram fragmentos do `ACCESS_TOKEN`.

Contrato Node ↔ microsserviço Python: [../sicoob/NODE_PYTHON_CONTRACT.md](../sicoob/NODE_PYTHON_CONTRACT.md).
