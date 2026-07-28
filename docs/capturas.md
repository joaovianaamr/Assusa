# Capturas de tela e material bruto

Todas as imagens e gravações do projeto ficam numa pasta única: **`docs/capturas/`**.

## ⚠️ Esta pasta NÃO está no git

`.gitignore` a exclui inteira, de propósito: este repositório é **público**, e os prints mostram
IDs de conta, meio de pagamento, PINs de duas etapas e, em alguns comandos curl do painel,
fragmentos do `ACCESS_TOKEN`.

**Consequência: não há backup.** Se a máquina morrer, o material some. É conteúdo valioso —
documenta passo a passo processos que só se faz uma vez a cada muito tempo. Guarde uma cópia
fora daqui (drive, HD externo, repositório privado).

## Estrutura

| Pasta | Conteúdo | Usada por |
| --- | --- | --- |
| `meta/info/` | Painel Meta: apps, WABAs, números, escopos do token | [meta/historico-migracao-smb.md](meta/historico-migracao-smb.md) |
| `meta/cadastro/` | Cadastro do número novo, passo a passo (27/07/2026) | [meta/playbook-numero-novo.md](meta/playbook-numero-novo.md) |
| `meta/permissoes/` | Telas de permissão / App Review | [meta/permissoes/](meta/permissoes/) |
| `diretrizes/` | Material bruto do setup no painel, inclui uma gravação de tela (29/06/2026) | — |
| `mei/` | Prints da emissão de NFS-e (dados fiscais pessoais) | — |
| `avulsas/` | Prints sem contexto atribuído | — |

## Convenções

- **Referencie sempre por caminho relativo** a partir do `.md`: `../capturas/meta/info/x.png`.
- **Escreva uma legenda** no `![]()` — o nome dos arquivos é timestamp puro e não diz nada.
  Sem legenda, um print órfão vira lixo em poucos meses.
- **Nunca mova um print sem atualizar quem o referencia.** Para conferir se algo quebrou:

```bash
grep -rn '!\[' docs/ --include='*.md'
```

## Nota sobre `mei/`

São prints de emissão de nota fiscal — dados fiscais pessoais, não do projeto. Estavam soltos em
`mei/` na raiz, **sem proteção do `.gitignore`**, e foram movidos para cá em 27/07/2026 junto com
um `image.png` solto na raiz. Se não tiverem mais utilidade, o lugar deles é fora do repositório.
