"""Lógica de sincronização de uma lei com o Planalto, com versionamento.

Regras de versionamento:
  - Cada sync COM mudança cria nova LeiVersao (html_raw + hash).
  - Dispositivos removidos: ativo=False + data_inativacao (nunca excluídos).
  - Anotações permanecem vinculadas ao dispositivo original mesmo após revogação.
  - Edições manuais de ementa/tipo_norma (PATCH) são preservadas (não sobrescritas).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Dispositivo, Lei, LeiVersao, SyncLog
from . import planalto


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def sincronizar_lei(db: Session, lei: Lei) -> dict:
    """Sincroniza uma lei. Retorna {status, mudancas, resumo}."""
    if not lei.url_sincronizacao:
        log = SyncLog(lei_id=lei.id, status="erro", erro_descricao="Lei sem url_sincronizacao.")
        db.add(log)
        db.commit()
        return {"status": "erro", "mudancas": False, "resumo": "Sem URL de sincronização."}

    try:
        dados = planalto.importar(lei.url_sincronizacao)
    except planalto.PlanaltoError as exc:
        log = SyncLog(lei_id=lei.id, status="erro", erro_descricao=str(exc))
        db.add(log)
        db.commit()
        return {"status": "erro", "mudancas": False, "resumo": str(exc)}

    novo_hash = dados["hash"]
    ultima_versao = (
        db.execute(
            select(LeiVersao)
            .where(LeiVersao.lei_id == lei.id)
            .order_by(LeiVersao.numero_versao.desc())
        )
        .scalars()
        .first()
    )

    if ultima_versao and ultima_versao.hash_conteudo == novo_hash:
        log = SyncLog(lei_id=lei.id, status="sem_mudanca", mudancas_detectadas=False)
        db.add(log)
        lei.data_ultima_sincronizacao = _agora()
        db.commit()
        return {"status": "sem_mudanca", "mudancas": False, "resumo": "Conteúdo idêntico."}

    # Há mudança → nova versão
    numero_versao = (ultima_versao.numero_versao + 1) if ultima_versao else 1
    versao = LeiVersao(
        lei_id=lei.id,
        numero_versao=numero_versao,
        hash_conteudo=novo_hash,
        html_raw=dados["html_raw"],
        alteracoes_resumo=f"Sincronização automática (v{numero_versao}).",
    )
    db.add(versao)
    db.flush()

    parsed = dados["dispositivos"]
    novos_ids = {p.identificador for p in parsed}

    existentes = (
        db.execute(select(Dispositivo).where(Dispositivo.lei_id == lei.id)).scalars().all()
    )
    por_identificador = {d.identificador: d for d in existentes}

    # Atualiza/insere
    for p in parsed:
        disp = por_identificador.get(p.identificador)
        if disp:
            if disp.texto_conteudo.strip() != p.texto_conteudo.strip():
                disp.texto_conteudo = p.texto_conteudo
                disp.status = "alterado"
            disp.ordem = p.ordem
            disp.versao_id = versao.id
            if not disp.ativo and disp.status != "revogado":
                disp.ativo = True
                disp.data_inativacao = None
        else:
            db.add(
                Dispositivo(
                    lei_id=lei.id,
                    versao_id=versao.id,
                    tipo=p.tipo,
                    identificador=p.identificador,
                    texto_conteudo=p.texto_conteudo,
                    ordem=p.ordem,
                    ativo=True,
                    status="original",
                )
            )

    # Dispositivos removidos → inativa (preserva anotações)
    for ident, disp in por_identificador.items():
        if ident not in novos_ids and disp.ativo:
            disp.ativo = False
            disp.status = "revogado"
            disp.data_inativacao = _agora()

    # Preserva edições manuais: só preenche ementa se estiver vazia
    if not (lei.ementa and lei.ementa.strip()) and dados.get("ementa"):
        lei.ementa = dados["ementa"]

    lei.data_ultima_sincronizacao = _agora()
    lei.data_ultima_atualizacao = _agora()

    log = SyncLog(lei_id=lei.id, status="ok", mudancas_detectadas=True)
    db.add(log)
    db.commit()
    return {
        "status": "ok",
        "mudancas": True,
        "resumo": f"Nova versão v{numero_versao} criada.",
    }
