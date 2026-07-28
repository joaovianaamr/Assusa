#!/usr/bin/env python3
"""Gera a logo da Assusa (a foto de perfil do bot no WhatsApp).

A marca e vetorial-por-codigo de proposito: nao existe arquivo de design a
perder, e regerar noutra cor ou tamanho e trocar um argumento.

    ./scripts/gerar-logo.py                          # assets/logo-assusa.png, 1024px
    ./scripts/gerar-logo.py --tamanho 512
    ./scripts/gerar-logo.py --paleta turquesa --saida /tmp/teste.png
    ./scripts/gerar-logo.py --sem-nome               # so o simbolo, sem "ASSUSA"
    ./scripts/gerar-logo.py --invertido              # marca colorida sobre branco
    ./scripts/gerar-logo.py --contato                # folha com todas as paletas

Depois de gerar, aplicar no perfil:

    ./scripts/meta-numero.sh foto assets/logo-assusa.png

Requisitos da Meta: quadrada, minimo 192x192, JPEG ou PNG, ate 5 MB. Ela reduz
para 640 e converte para JPEG do lado dela — por isso o master aqui e maior.

Depende de Pillow (pip install Pillow).
"""
import argparse
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

# Desenha em 4x e reduz com LANCZOS. Pillow nao antialiasa poligono, entao o
# supersampling e o unico motivo de a borda da gota sair limpa.
SUPER = 4

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PADRAO = os.path.join(RAIZ, "assets", "logo-assusa.png")

BOLD = "/usr/share/fonts/truetype/croscore/Arimo-Bold.ttf"
BRANCO = (255, 255, 255)

# Gradiente diagonal: claro no topo-esquerda, profundo embaixo-direita.
PALETAS = {
    "azul":      ((56, 189, 248), (2, 105, 161)),
    "turquesa":  ((45, 212, 191), (13, 100, 116)),
    "verdeagua": ((110, 231, 183), (6, 120, 118)),
    "navy":      ((30, 120, 200), (12, 45, 95)),
}


def fundo(n, paleta, solido=False):
    c1, c2 = PALETAS[paleta]
    if solido:
        return Image.new("RGB", (n, n), c2)
    # Monta pequeno e amplia: 65k pixels em vez de milhoes, resultado identico.
    k = 256
    px = [tuple(round(a + (b - a) * ((x + y) / (2 * (k - 1))))
                for a, b in zip(c1, c2))
          for y in range(k) for x in range(k)]
    g = Image.new("RGB", (k, k))
    g.putdata(px)
    return g.resize((n, n), Image.BICUBIC)


def contorno_gota(cx, cy, r, alonga=1.55):
    """Gota: apice em cima, circulo embaixo, unidos pelas retas tangentes."""
    d = r * alonga
    phi = math.acos(r / d)
    pts = [(cx, cy - d)]
    a0, a1 = -math.pi / 2 + phi, 3 * math.pi / 2 - phi
    passos = 240
    for i in range(passos + 1):
        a = a0 + (a1 - a0) * i / passos
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def ondas(d, cx, cy, larg, cor, amp=0.075, esp=0.13):
    """Duas senoides empilhadas. Amplitude baixa e faixas bem separadas: com
    amplitude alta as duas se cruzam e o desenho vira um 'X', que nao le como agua."""
    for k, dy in enumerate((-0.17, 0.17)):
        topo, base = [], []
        for i in range(121):
            t = i / 120
            x = cx - larg / 2 + larg * t
            y = cy + larg * dy + math.sin(t * 2 * math.pi + k * math.pi) * larg * amp
            topo.append((x, y - larg * esp / 2))
            base.append((x, y + larg * esp / 2))
        d.polygon(topo + base[::-1], fill=cor)


def desenhar(tamanho, paleta="azul", nome="ASSUSA", solido=False, invertido=False):
    n = tamanho * SUPER
    if not os.path.exists(BOLD):
        sys.exit(f"fonte nao encontrada: {BOLD}\ninstale com: sudo apt install fonts-croscore")

    cor_fundo = Image.new("RGB", (n, n), BRANCO) if invertido else fundo(n, paleta, solido)
    tinta = fundo(n, paleta, solido) if invertido else Image.new("RGB", (n, n), BRANCO)

    # Com nome embaixo o simbolo encolhe e sobe para abrir espaco.
    if nome:
        r, cx, cy = n * 0.175, n * 0.53, n * 0.40
    else:
        r, cx, cy = n * 0.245, n * 0.53, n * 0.53

    # A silhueta vira mascara e a "tinta" preenche: assim o gradiente se
    # comporta igual na marca e no fundo, inclusive no modo invertido.
    sil = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(sil)
    d.polygon(contorno_gota(cx, cy, r), fill=255)
    # O rabicho na base-esquerda e o que transforma a gota em balao de fala.
    d.polygon([(cx - r * 0.86, cy + r * 0.50),
               (cx - r * 0.20, cy + r * 0.97),
               (cx - r * 1.32, cy + r * 1.30)], fill=255)
    cor_fundo.paste(tinta, (0, 0), sil)

    # As ondas sao vazadas na gota — deixam o fundo aparecer, nao sao pintadas por cima.
    furo = Image.new("L", (n, n), 0)
    ondas(ImageDraw.Draw(furo), cx, cy + r * 0.10, r * 1.20, 255)
    cor_fundo.paste(Image.new("RGB", (n, n), BRANCO) if invertido
                    else fundo(n, paleta, solido), (0, 0), furo)

    if nome:
        cor = PALETAS[paleta][1] if invertido else BRANCO
        f = ImageFont.truetype(BOLD, int(n * 0.135))
        esp = n * 0.014  # nome curto em caixa alta pede respiro entre letras
        larg = sum(f.getlength(ch) for ch in nome) + esp * (len(nome) - 1)
        x = (n - larg) / 2
        dw = ImageDraw.Draw(cor_fundo)
        for ch in nome:
            dw.text((x, n * 0.665), ch, font=f, fill=cor)
            x += f.getlength(ch) + esp

    return cor_fundo.resize((tamanho, tamanho), Image.LANCZOS)


def folha_contato(destino, tamanho=300):
    """Todas as paletas lado a lado, com previa de 48px — o tamanho real na
    lista de conversas do WhatsApp. Se some aqui, o desenho falhou."""
    itens = [(p, desenhar(tamanho, paleta=p)) for p in PALETAS]
    itens.append(("invertido", desenhar(tamanho, invertido=True)))
    itens.append(("sem nome", desenhar(tamanho, nome=None)))

    pad, lab = 16, 26
    cols = 3
    linhas = (len(itens) + cols - 1) // cols
    alt = tamanho + 48 + lab
    img = Image.new("RGB", (cols * tamanho + (cols + 1) * pad,
                            linhas * (alt + pad) + pad), (245, 245, 247))
    dd = ImageDraw.Draw(img)
    f = ImageFont.truetype(BOLD, 17)
    for i, (nome, im) in enumerate(itens):
        x = pad + (i % cols) * (tamanho + pad)
        y = pad + (i // cols) * (alt + pad)
        img.paste(im, (x, y))
        img.paste(im.resize((48, 48), Image.LANCZOS), (x, y + tamanho + 4))
        dd.text((x + 56, y + tamanho + 14), nome, font=f, fill=(40, 40, 45))
    img.save(destino)
    return destino


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--tamanho", type=int, default=1024, help="lado em px (padrao 1024)")
    p.add_argument("--paleta", choices=sorted(PALETAS), default="azul")
    p.add_argument("--saida", default=PADRAO)
    p.add_argument("--sem-nome", action="store_true", help="so o simbolo")
    p.add_argument("--solido", action="store_true", help="fundo chapado, sem gradiente")
    p.add_argument("--invertido", action="store_true", help="marca colorida sobre branco")
    p.add_argument("--contato", action="store_true", help="folha com todas as paletas")
    a = p.parse_args()

    if a.tamanho < 192:
        sys.exit("a Meta exige no minimo 192x192")

    os.makedirs(os.path.dirname(os.path.abspath(a.saida)), exist_ok=True)
    if a.contato:
        print(folha_contato(a.saida if a.saida != PADRAO
                            else os.path.join(RAIZ, "assets", "logo-paletas.png")))
        return

    im = desenhar(a.tamanho, paleta=a.paleta, nome=None if a.sem_nome else "ASSUSA",
                  solido=a.solido, invertido=a.invertido)
    im.save(a.saida)
    print(f"{a.saida} ({im.width}x{im.height})")


if __name__ == "__main__":
    main()
