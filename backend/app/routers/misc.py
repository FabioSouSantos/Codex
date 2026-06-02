"""Endpoints diversos: atualizações recentes (landing page) e health-check."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ComentarioPessoal, Dispositivo, Doutrina, Jurisprudencia, Lei, Usuario
from ..schemas import AtualizacaoRecente

router = APIRouter(prefix="/api", tags=["misc"])

JANELA_DIAS = 6


def _titulo_lei(lei: Lei) -> str:
    partes = [lei.tipo_norma]
    if lei.numero:
        partes.append(f"nº {lei.numero}")
    if lei.ano:
        partes.append(f"/{lei.ano}")
    return " ".join(partes).strip()


@router.get("/atualizacoes-recentes", response_model=list[AtualizacaoRecente])
def atualizacoes_recentes(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    """Últimas anotações (doutrina/juris/comentário próprio) dos últimos 6 dias."""
    limite = datetime.now(timezone.utc) - timedelta(days=JANELA_DIAS)
    resultados: list[AtualizacaoRecente] = []

    def contexto(disp_id: int) -> tuple[Dispositivo | None, Lei | None]:
        disp = db.get(Dispositivo, disp_id)
        lei = db.get(Lei, disp.lei_id) if disp else None
        return disp, lei

    doutrinas = (
        db.execute(select(Doutrina).where(Doutrina.criado_em >= limite)).scalars().all()
    )
    for d in doutrinas:
        disp, lei = contexto(d.dispositivo_id)
        if disp and lei:
            resumo = d.titulo_obra or d.texto_generico or d.citacao_abnt_gerada or "Doutrina"
            resultados.append(AtualizacaoRecente(
                tipo="doutrina", anotacao_id=d.id, dispositivo_id=disp.id, lei_id=lei.id,
                lei_titulo=_titulo_lei(lei), dispositivo_identificador=disp.identificador,
                resumo=resumo[:160], criado_em=d.criado_em,
            ))

    juris = (
        db.execute(select(Jurisprudencia).where(Jurisprudencia.criado_em >= limite)).scalars().all()
    )
    for j in juris:
        disp, lei = contexto(j.dispositivo_id)
        if disp and lei:
            resumo = j.numero_processo or j.texto_generico or j.citacao_abnt_gerada or "Jurisprudência"
            resultados.append(AtualizacaoRecente(
                tipo="jurisprudencia", anotacao_id=j.id, dispositivo_id=disp.id, lei_id=lei.id,
                lei_titulo=_titulo_lei(lei), dispositivo_identificador=disp.identificador,
                resumo=resumo[:160], criado_em=j.criado_em,
            ))

    # comentários SOMENTE do usuário atual
    comentarios = (
        db.execute(
            select(ComentarioPessoal).where(
                ComentarioPessoal.criado_em >= limite,
                ComentarioPessoal.usuario_id == usuario.id,
            )
        )
        .scalars()
        .all()
    )
    for c in comentarios:
        disp, lei = contexto(c.dispositivo_id)
        if disp and lei:
            resultados.append(AtualizacaoRecente(
                tipo="comentario", anotacao_id=c.id, dispositivo_id=disp.id, lei_id=lei.id,
                lei_titulo=_titulo_lei(lei), dispositivo_identificador=disp.identificador,
                resumo=(c.texto or "Comentário")[:160], criado_em=c.criado_em,
            ))

    resultados.sort(key=lambda r: r.criado_em, reverse=True)
    return resultados


@router.get("/health")
def health():
    return {"status": "ok"}
