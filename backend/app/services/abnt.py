"""Geração de citações no padrão ABNT."""
from __future__ import annotations

from typing import Optional


def _limpa(v: Optional[str]) -> str:
    return (v or "").strip()


def citacao_doutrina(
    autor: Optional[str],
    titulo_obra: Optional[str],
    edicao: Optional[str],
    cidade: Optional[str],
    editora: Optional[str],
    ano_publicacao: Optional[str],
    paginas: Optional[str],
) -> str:
    """SOBRENOME, Nome. Título. ed. Cidade: Editora, ano. p. xxx."""
    partes: list[str] = []
    autor = _limpa(autor)
    titulo = _limpa(titulo_obra)
    if autor:
        partes.append(f"{autor}.")
    if titulo:
        partes.append(f"{titulo}.")

    ed = _limpa(edicao)
    if ed:
        # normaliza para "x. ed."
        ed_norm = ed if "ed" in ed.lower() else f"{ed}. ed."
        partes.append(ed_norm if ed_norm.endswith(".") else f"{ed_norm}.")

    cidade_v = _limpa(cidade)
    editora_v = _limpa(editora)
    ano_v = _limpa(ano_publicacao)
    local_seg = ""
    if cidade_v and editora_v:
        local_seg = f"{cidade_v}: {editora_v}"
    elif cidade_v:
        local_seg = cidade_v
    elif editora_v:
        local_seg = editora_v
    if local_seg and ano_v:
        partes.append(f"{local_seg}, {ano_v}.")
    elif local_seg:
        partes.append(f"{local_seg}.")
    elif ano_v:
        partes.append(f"{ano_v}.")

    pag = _limpa(paginas)
    if pag:
        partes.append(f"p. {pag}.")

    return " ".join(partes).strip()


def citacao_jurisprudencia(
    tribunal: Optional[str],
    tipo_decisao: Optional[str],
    numero_processo: Optional[str],
    relator: Optional[str],
    orgao_julgador: Optional[str],
    data_julgamento: Optional[str],
    veiculo_publicacao: Optional[str],
) -> str:
    """BRASIL. Tribunal. Tipo. Processo. Relator. Órgão. Julgado em data."""
    partes: list[str] = ["BRASIL."]
    for campo, sufixo in [
        (tribunal, "."),
        (tipo_decisao, "."),
        (numero_processo, "."),
    ]:
        v = _limpa(campo)
        if v:
            partes.append(f"{v}{sufixo}")

    relator_v = _limpa(relator)
    if relator_v:
        rel = relator_v if relator_v.lower().startswith("rel") else f"Rel. {relator_v}"
        partes.append(f"{rel}.")

    orgao_v = _limpa(orgao_julgador)
    if orgao_v:
        partes.append(f"{orgao_v}.")

    data_v = _limpa(data_julgamento)
    if data_v:
        partes.append(f"Julgado em {data_v}.")

    veiculo_v = _limpa(veiculo_publicacao)
    if veiculo_v:
        partes.append(f"{veiculo_v}.")

    return " ".join(partes).strip()
