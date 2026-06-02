"""Endpoints de anotações: doutrina, jurisprudência e comentário pessoal.

Detecção de duplicatas: ao submeter, se já existir anotação equivalente no mesmo
dispositivo, retorna HTTP 409 com detail "DUPLICATA:{id}" (a menos que forcar=True).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_editor
from ..models import ComentarioPessoal, Dispositivo, Doutrina, Jurisprudencia, Usuario
from ..schemas import (
    ComentarioCreate,
    ComentarioOut,
    DoutrinaCreate,
    DoutrinaOut,
    JurisprudenciaCreate,
    JurisprudenciaOut,
)
from ..services import activity
from ..services.abnt import citacao_doutrina, citacao_jurisprudencia

router = APIRouter(prefix="/api/dispositivos", tags=["anotacoes"])


def _norm(v: str | None) -> str:
    return (v or "").strip().lower()


def _get_dispositivo(db: Session, disp_id: int) -> Dispositivo:
    disp = db.get(Dispositivo, disp_id)
    if disp is None:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado.")
    return disp


# ----------------------------------------------------------------------------
# Doutrina
# ----------------------------------------------------------------------------
@router.post("/{disp_id}/doutrinas", response_model=DoutrinaOut, status_code=status.HTTP_201_CREATED)
def criar_doutrina(
    disp_id: int,
    payload: DoutrinaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    _get_dispositivo(db, disp_id)

    if not payload.forcar:
        existentes = (
            db.execute(select(Doutrina).where(Doutrina.dispositivo_id == disp_id)).scalars().all()
        )
        for d in existentes:
            if (
                _norm(d.autor) == _norm(payload.autor)
                and _norm(d.titulo_obra) == _norm(payload.titulo_obra)
                and _norm(d.paginas) == _norm(payload.paginas)
                and (payload.autor or payload.titulo_obra)
            ):
                raise HTTPException(status_code=409, detail=f"DUPLICATA:{d.id}")

    citacao = citacao_doutrina(
        payload.autor, payload.titulo_obra, payload.edicao,
        payload.cidade, payload.editora, payload.ano_publicacao, payload.paginas,
    )
    doutrina = Doutrina(
        dispositivo_id=disp_id,
        usuario_id=usuario.id,
        texto_generico=payload.texto_generico,
        comentario_usuario=payload.comentario_usuario,
        autor=payload.autor,
        titulo_obra=payload.titulo_obra,
        edicao=payload.edicao,
        editora=payload.editora,
        cidade=payload.cidade,
        ano_publicacao=payload.ano_publicacao,
        paginas=payload.paginas,
        citacao_abnt_gerada=citacao,
    )
    db.add(doutrina)
    db.commit()
    db.refresh(doutrina)
    activity.registrar(db, usuario.id, "criar_doutrina", "doutrina", doutrina.id)
    return doutrina


@router.delete("/{disp_id}/doutrinas/{anotacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_doutrina(
    disp_id: int,
    anotacao_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    d = db.get(Doutrina, anotacao_id)
    if d is None or d.dispositivo_id != disp_id:
        raise HTTPException(status_code=404, detail="Doutrina não encontrada.")
    if d.usuario_id != usuario.id and usuario.papel != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão para excluir esta anotação.")
    db.delete(d)
    db.commit()
    activity.registrar(db, usuario.id, "excluir_doutrina", "doutrina", anotacao_id)


# ----------------------------------------------------------------------------
# Jurisprudência
# ----------------------------------------------------------------------------
@router.post("/{disp_id}/jurisprudencias", response_model=JurisprudenciaOut, status_code=status.HTTP_201_CREATED)
def criar_jurisprudencia(
    disp_id: int,
    payload: JurisprudenciaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    _get_dispositivo(db, disp_id)

    if not payload.forcar:
        existentes = (
            db.execute(select(Jurisprudencia).where(Jurisprudencia.dispositivo_id == disp_id))
            .scalars()
            .all()
        )
        for j in existentes:
            mesmo_processo = _norm(j.numero_processo) == _norm(payload.numero_processo) and payload.numero_processo
            mesmo_conjunto = (
                _norm(j.tribunal) == _norm(payload.tribunal)
                and _norm(j.tipo_decisao) == _norm(payload.tipo_decisao)
                and _norm(j.relator) == _norm(payload.relator)
                and (payload.tribunal or payload.relator)
            )
            if mesmo_processo or mesmo_conjunto:
                raise HTTPException(status_code=409, detail=f"DUPLICATA:{j.id}")

    citacao = citacao_jurisprudencia(
        payload.tribunal, payload.tipo_decisao, payload.numero_processo,
        payload.relator, payload.orgao_julgador, payload.data_julgamento,
        payload.veiculo_publicacao,
    )
    juris = Jurisprudencia(
        dispositivo_id=disp_id,
        usuario_id=usuario.id,
        texto_generico=payload.texto_generico,
        tribunal=payload.tribunal,
        tipo_decisao=payload.tipo_decisao,
        numero_processo=payload.numero_processo,
        relator=payload.relator,
        orgao_julgador=payload.orgao_julgador,
        data_julgamento=payload.data_julgamento,
        veiculo_publicacao=payload.veiculo_publicacao,
        citacao_abnt_gerada=citacao,
    )
    db.add(juris)
    db.commit()
    db.refresh(juris)
    activity.registrar(db, usuario.id, "criar_jurisprudencia", "jurisprudencia", juris.id)
    return juris


@router.delete("/{disp_id}/jurisprudencias/{anotacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_jurisprudencia(
    disp_id: int,
    anotacao_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    j = db.get(Jurisprudencia, anotacao_id)
    if j is None or j.dispositivo_id != disp_id:
        raise HTTPException(status_code=404, detail="Jurisprudência não encontrada.")
    if j.usuario_id != usuario.id and usuario.papel != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão para excluir esta anotação.")
    db.delete(j)
    db.commit()
    activity.registrar(db, usuario.id, "excluir_jurisprudencia", "jurisprudencia", anotacao_id)


# ----------------------------------------------------------------------------
# Comentário pessoal (também armazena links cruzados com prefixo 🔗 [LINK])
# Visível SOMENTE ao usuário que criou — nunca exposto a outros usuários.
# ----------------------------------------------------------------------------
@router.post("/{disp_id}/comentarios", response_model=ComentarioOut, status_code=status.HTTP_201_CREATED)
def criar_comentario(
    disp_id: int,
    payload: ComentarioCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    _get_dispositivo(db, disp_id)
    comentario = ComentarioPessoal(
        dispositivo_id=disp_id,
        usuario_id=usuario.id,
        texto=payload.texto,
    )
    db.add(comentario)
    db.commit()
    db.refresh(comentario)
    activity.registrar(db, usuario.id, "criar_comentario", "comentario", comentario.id)
    return comentario


@router.delete("/{disp_id}/comentarios/{anotacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_comentario(
    disp_id: int,
    anotacao_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    c = db.get(ComentarioPessoal, anotacao_id)
    if c is None or c.dispositivo_id != disp_id:
        raise HTTPException(status_code=404, detail="Comentário não encontrado.")
    # comentário pessoal só pode ser excluído pelo próprio autor
    if c.usuario_id != usuario.id:
        raise HTTPException(status_code=403, detail="Sem permissão para excluir este comentário.")
    db.delete(c)
    db.commit()
    activity.registrar(db, usuario.id, "excluir_comentario", "comentario", anotacao_id)
