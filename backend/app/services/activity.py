"""Registro de atividade (activity_logs)."""
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from ..models import ActivityLog


def registrar(
    db: Session,
    usuario_id: Optional[int],
    tipo_acao: str,
    entidade: Optional[str] = None,
    entidade_id: Optional[int] = None,
    descricao: Optional[str] = None,
    ip: Optional[str] = None,
    commit: bool = True,
) -> ActivityLog:
    log = ActivityLog(
        usuario_id=usuario_id,
        tipo_acao=tipo_acao,
        entidade=entidade,
        entidade_id=entidade_id,
        descricao=descricao,
        ip=ip,
    )
    db.add(log)
    if commit:
        db.commit()
    return log
