"""Parser de texto legislativo bruto em dispositivos (artigo/parágrafo/inciso/alínea).

Reconhece os padrões do Planalto:
  - Art. 1º  /  Art. 1o  /  Art. 1  /  Artigo 1º
  - § 1º  /  § 1o  /  Parágrafo único
  - Incisos romanos:  I -  /  II –  /  XIV -
  - Alíneas:  a)  b)  c)
"""
from __future__ import annotations

import re
from dataclasses import dataclass

ROMANO = r"(?:M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3}))"

RE_ARTIGO = re.compile(r"^\s*Art\.?\s*(\d+)\s*(?:º|o|ª|a|\.|-|–|\s)", re.IGNORECASE)
RE_ARTIGO_ALT = re.compile(r"^\s*Artigo\s+(\d+)", re.IGNORECASE)
RE_PARAGRAFO = re.compile(r"^\s*§\s*(\d+)\s*(?:º|o|\.|-|–|\s)?", re.IGNORECASE)
RE_PARAGRAFO_UNICO = re.compile(r"^\s*Par[áa]grafo\s+[úu]nico", re.IGNORECASE)
RE_INCISO = re.compile(rf"^\s*({ROMANO})\s*[-–.)]\s+", re.IGNORECASE)
RE_ALINEA = re.compile(r"^\s*([a-z])\s*\)\s+", re.IGNORECASE)


@dataclass
class DispositivoParsed:
    tipo: str
    identificador: str
    texto_conteudo: str
    ordem: int


def _eh_inciso_valido(token: str) -> bool:
    """Evita falsos positivos de romano (linhas que começam com 'I' de palavra)."""
    return bool(token) and token.upper() == token and re.fullmatch(ROMANO, token.upper()) is not None


def parse_texto(texto: str) -> list[DispositivoParsed]:
    if not texto:
        return []

    # normaliza quebras e espaços
    texto = texto.replace("\r\n", "\n").replace("\r", "\n")
    linhas = [ln.strip() for ln in texto.split("\n")]

    dispositivos: list[DispositivoParsed] = []
    ordem = 0
    atual: DispositivoParsed | None = None

    def flush():
        nonlocal atual
        if atual is not None:
            atual.texto_conteudo = atual.texto_conteudo.strip()
            dispositivos.append(atual)
            atual = None

    for linha in linhas:
        if not linha:
            if atual is not None:
                atual.texto_conteudo += "\n"
            continue

        m_art = RE_ARTIGO.match(linha) or RE_ARTIGO_ALT.match(linha)
        m_par_unico = RE_PARAGRAFO_UNICO.match(linha)
        m_par = RE_PARAGRAFO.match(linha)
        m_inc = RE_INCISO.match(linha)
        m_ali = RE_ALINEA.match(linha)

        if m_art:
            flush()
            ordem += 1
            num = m_art.group(1)
            atual = DispositivoParsed("artigo", f"Art. {num}º", linha, ordem)
        elif m_par_unico:
            flush()
            ordem += 1
            atual = DispositivoParsed("paragrafo", "Parágrafo único", linha, ordem)
        elif m_par:
            flush()
            ordem += 1
            num = m_par.group(1)
            atual = DispositivoParsed("paragrafo", f"§ {num}º", linha, ordem)
        elif m_inc and _eh_inciso_valido(m_inc.group(1)):
            flush()
            ordem += 1
            rom = m_inc.group(1).upper()
            atual = DispositivoParsed("inciso", rom, linha, ordem)
        elif m_ali:
            flush()
            ordem += 1
            letra = m_ali.group(1).lower()
            atual = DispositivoParsed("alinea", f"{letra})", linha, ordem)
        else:
            # continuação do dispositivo corrente
            if atual is not None:
                atual.texto_conteudo += " " + linha
            else:
                ordem += 1
                atual = DispositivoParsed("outro", "—", linha, ordem)

    flush()

    # remove dispositivos completamente vazios
    return [d for d in dispositivos if d.texto_conteudo.strip()]
