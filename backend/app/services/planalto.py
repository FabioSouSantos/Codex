"""Scraping de normas do planalto.gov.br.

O Planalto serve HTML em ISO-8859-1 frequentemente sem declarar o charset
corretamente no header HTTP. Estratégia:
  1. Lê os bytes crus.
  2. Tenta detectar charset pela meta tag.
  3. Fallback para latin-1 (ISO-8859-1).
"""
from __future__ import annotations

import hashlib
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from .parser import DispositivoParsed, parse_texto

DOMINIOS_PERMITIDOS = ("planalto.gov.br", "www.planalto.gov.br")

RE_META_CHARSET = re.compile(
    rb"""<meta[^>]+charset=['"]?\s*([\w\-]+)""", re.IGNORECASE
)


class PlanaltoError(Exception):
    pass


def url_permitida(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    return any(host == d or host.endswith("." + d) for d in DOMINIOS_PERMITIDOS)


def _detecta_charset(conteudo: bytes, header_charset: str | None) -> str:
    if header_charset:
        return header_charset
    m = RE_META_CHARSET.search(conteudo[:4000])
    if m:
        try:
            return m.group(1).decode("ascii").lower()
        except Exception:
            pass
    return "latin-1"


def baixar_html(url: str) -> str:
    if not url_permitida(url):
        raise PlanaltoError("URL fora do domínio permitido (planalto.gov.br).")
    try:
        with httpx.Client(follow_redirects=True, timeout=40.0, headers={"User-Agent": "Codex/1.0"}) as client:
            resp = client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise PlanaltoError(f"Falha ao acessar o Planalto: {exc}") from exc

    conteudo = resp.content
    charset = _detecta_charset(conteudo, resp.charset_encoding)
    try:
        html = conteudo.decode(charset, errors="replace")
    except (LookupError, UnicodeDecodeError):
        html = conteudo.decode("latin-1", errors="replace")
    return html


def extrai_texto(html: str) -> str:
    """Extrai o texto legível do corpo da norma."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    # o Planalto costuma usar <p> para cada dispositivo
    paragrafos = [p.get_text(" ", strip=True) for p in soup.find_all(["p", "div"])]
    texto = "\n".join(t for t in paragrafos if t)
    if not texto.strip():
        texto = soup.get_text("\n", strip=True)
    return texto


def extrai_ementa(html: str) -> str | None:
    soup = BeautifulSoup(html, "lxml")
    for p in soup.find_all("p"):
        txt = p.get_text(" ", strip=True)
        if txt and len(txt) > 30 and ("." in txt) and not txt.lower().startswith("art"):
            return txt[:1000]
    return None


def hash_conteudo(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8", errors="replace")).hexdigest()


def importar(url: str) -> dict:
    """Retorna dict com html_raw, texto, hash, ementa e dispositivos parseados."""
    html = baixar_html(url)
    texto = extrai_texto(html)
    dispositivos: list[DispositivoParsed] = parse_texto(texto)
    return {
        "html_raw": html,
        "texto": texto,
        "hash": hash_conteudo(texto),
        "ementa": extrai_ementa(html),
        "dispositivos": dispositivos,
    }
