# Configuração do app na Meta (WhatsApp Cloud API)

Configuração do app/WABA no painel da Meta — não faz parte do runtime.

| Doc | Quando ler |
| --- | --- |
| [referencia.md](referencia.md) | **Comece aqui.** IDs de App/Business/WABA, números e seus estados, escopos do token, webhook, cobrança. Tudo conferido por Graph API. |
| [playbook-numero-novo.md](playbook-numero-novo.md) | Vai cadastrar um número novo na Cloud API. Receita testada, com as armadilhas na ordem em que aparecem. |
| [historico-migracao-smb.md](historico-migracao-smb.md) | Entender por que o número fixo travou, ou diagnosticar um erro estranho da Meta. Registro cronológico + tabela de diagnósticos falsos. |
| [permissoes/](permissoes/) | Justificativas de uso das permissões para o App Review. |

## Duas coisas que economizam horas

**A Meta reporta erros estruturais como se fossem transitórios.** Em jul/2026, cinco diagnósticos
seguidos (do painel, da API e da IA da Meta) apontaram causas erradas — token, operadora, rate
limit, vínculo de conta, forma de pagamento. Nenhum se sustentou. **Confirme sempre por Graph API
antes de agir.** A tabela no fim do histórico lista cada um e o que era de verdade.

**Nunca instale WhatsApp no chip de um número destinado à Cloud API.** É irreversível na prática:
o número vira `ON_PREMISE` e não há caminho de volta que funcione.

## Ferramenta

[`scripts/meta-numero.sh`](../../scripts/meta-numero.sh) — `listar`, `status`, `pedir-codigo`,
`verificar`, `registrar`. Cada etapa é um comando separado de propósito: pedir código tem rate
limit agressivo e tentativas perdidas renovam o cooldown.

## Capturas

Os prints referenciados nestes documentos ficam em `docs/capturas/`, **fora do git**.
Ver [../capturas.md](../capturas.md).

Contrato Node ↔ microsserviço Python: [../sicoob/NODE_PYTHON_CONTRACT.md](../sicoob/NODE_PYTHON_CONTRACT.md).
