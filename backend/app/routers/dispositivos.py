"""Endpoints de dispositivos (aninhados em /api/leis/{lei_id})."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_editor
from ..models import (
    ComentarioPessoal,
    Dispositivo,
    Doutrina,
    Jurisprudencia,
    Lei,
    Usuario,
)
from ..schemas import (
    ComentarioOut,
    DispositivoCompleto,
    DispositivoCreate,
    DispositivoOut,
    DispositivoUpdate,
    DoutrinaOut,
    JurisprudenciaOut,
)
from ..services import activity

router = APIRouter(prefix="/api/leis", tags=["dispositivos"])


def _agora() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/{lei_id}/dispositivos", response_model=list[DispositivoCompleto])
def listar_dispositivos(
    lei_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    lei = db.get(Lei, lei_id)
    if lei is None:
        raise HTTPException(status_code=404, detail="Lei não encontrada.")

    dispositivos = (
        db.execute(
            select(Dispositivo).where(Dispositivo.lei_id == lei_id).order_by(Dispositivo.ordem)
        )
        .scalars()
        .all()
    )

    resultado: list[DispositivoCompleto] = []
    for disp in dispositivos:
        doutrinas = [DoutrinaOut.model_validate(d) for d in disp.doutrinas]
        juris = [JurisprudenciaOut.model_validate(j) for j in disp.jurisprudencias]
        # comentários pessoais: SOMENTE do usuário atual
        comentarios = [
            ComentarioOut.model_validate(c)
            for c in disp.comentarios
            if c.usuario_id == usuario.id
        ]
        item = DispositivoCompleto(
            **DispositivoOut.model_validate(disp).model_dump(),
            doutrinas=doutrinas,
            jurisprudencias=juris,
            comentarios=comentarios,
        )
        resultado.append(item)
    return resultado


@router.post("/{lei_id}/dispositivos", response_model=DispositivoOut, status_code=status.HTTP_201_CREATED)
def criar_dispositivo(
    lei_id: int,
    payload: DispositivoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    lei = db.get(Lei, lei_id)
    if lei is None:
        raise HTTPException(status_code=404, detail="Lei não encontrada.")

    disp = Dispositivo(
        lei_id=lei_id,
        tipo=payload.tipo,
        identificador=payload.identificador,
        texto_conteudo=payload.texto_conteudo,
        ordem=payload.ordem,
        ativo=payload.ativo,
        status=payload.status,
    )
    if payload.status == "revogado":
        disp.ativo = False
        disp.data_inativacao = _agora()
    db.add(disp)
    db.commit()
    db.refresh(disp)
    activity.registrar(db, usuario.id, "criar_dispositivo", "dispositivo", disp.id, descricao=disp.identificador)
    return disp


@router.patch("/{lei_id}/dispositivos/{disp_id}", response_model=DispositivoOut)
def editar_dispositivo(
    lei_id: int,
    disp_id: int,
    payload: DispositivoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    disp = db.get(Dispositivo, disp_id)
    if disp is None or disp.lei_id != lei_id:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado.")

    dados = payload.model_dump(exclude_unset=True)
    for campo, valor in dados.items():
        setattr(disp, campo, valor)

    # Regra: status=revogado → ativo=False + data_inativacao automática
    if disp.status == "revogado":
        disp.ativo = False
        if disp.data_inativacao is None:
            disp.data_inativacao = _agora()
    elif disp.status in ("original", "alterado") and "ativo" not in dados:
        # ao reativar via status, limpa inativação se não foi explicitamente setado
        if disp.ativo:
            disp.data_inativacao = None

    db.commit()
    db.refresh(disp)
    activity.registrar(db, usuario.id, "editar_dispositivo", "dispositivo", disp.id, descricao=disp.identificador)
    return disp
