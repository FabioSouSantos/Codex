"""Endpoints de leis: listagem, cadastro manual, importação por URL,
parse de texto, edição de metadados, exclusão e sincronização."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_admin, get_current_user, get_editor
from ..models import Dispositivo, Lei, LeiVersao
from ..models import Usuario
from ..schemas import (
    DispositivoParsePreview,
    ImportarUrlIn,
    LeiCreate,
    LeiManualCompleta,
    LeiOut,
    LeiUpdate,
    ParseTextoIn,
)
from ..services import activity, planalto
from ..services.parser import parse_texto
from ..services.sync import sincronizar_lei

router = APIRouter(prefix="/api/leis", tags=["leis"])


def _agora() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=list[LeiOut])
def listar_leis(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    return db.execute(select(Lei).order_by(Lei.criado_em.desc())).scalars().all()


@router.get("/{lei_id}", response_model=LeiOut)
def obter_lei(lei_id: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    lei = db.get(Lei, lei_id)
    if lei is None:
        raise HTTPException(status_code=404, detail="Lei não encontrada.")
    return lei


@router.post("", response_model=LeiOut, status_code=status.HTTP_201_CREATED)
def criar_lei_manual(
    payload: LeiCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    """Cadastro manual — passo 1 (apenas metadados)."""
    lei = Lei(**payload.model_dump(), cadastro_manual=True)
    db.add(lei)
    db.commit()
    db.refresh(lei)
    activity.registrar(db, usuario.id, "criar_lei", "lei", lei.id, descricao=lei.tipo_norma)
    return lei


@router.post("/parse-texto", response_model=list[DispositivoParsePreview])
def parse_texto_endpoint(
    payload: ParseTextoIn,
    _: Usuario = Depends(get_editor),
):
    """Pré-visualização: parse de texto livre → dispositivos (não persiste)."""
    parsed = parse_texto(payload.texto)
    return [
        DispositivoParsePreview(
            tipo=p.tipo, identificador=p.identificador,
            texto_conteudo=p.texto_conteudo, ordem=p.ordem,
        )
        for p in parsed
    ]


@router.post("/manual-completo", response_model=LeiOut, status_code=status.HTTP_201_CREATED)
def criar_lei_manual_completo(
    payload: LeiManualCompleta,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    """Cadastro manual — confirma metadados + texto, persistindo dispositivos."""
    lei = Lei(**payload.metadados.model_dump(), cadastro_manual=True)
    db.add(lei)
    db.flush()

    versao = LeiVersao(
        lei_id=lei.id, numero_versao=1,
        hash_conteudo=planalto.hash_conteudo(payload.texto),
        alteracoes_resumo="Cadastro manual inicial.",
    )
    db.add(versao)
    db.flush()

    for p in parse_texto(payload.texto):
        db.add(Dispositivo(
            lei_id=lei.id, versao_id=versao.id, tipo=p.tipo,
            identificador=p.identificador, texto_conteudo=p.texto_conteudo,
            ordem=p.ordem, ativo=True, status="original",
        ))
    lei.data_ultima_atualizacao = _agora()
    db.commit()
    db.refresh(lei)
    activity.registrar(db, usuario.id, "criar_lei_manual", "lei", lei.id, descricao=lei.tipo_norma)
    return lei


@router.post("/importar-url", response_model=LeiOut, status_code=status.HTTP_201_CREATED)
def importar_url(
    payload: ImportarUrlIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    """Importação a partir de uma URL do Planalto."""
    if not planalto.url_permitida(payload.url):
        raise HTTPException(status_code=400, detail="URL fora do domínio planalto.gov.br.")
    try:
        dados = planalto.importar(payload.url)
    except planalto.PlanaltoError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    lei = Lei(
        tipo_norma="Norma importada",
        ementa=dados.get("ementa"),
        url_sincronizacao=payload.url,
        url_repositorio=payload.url,
        cadastro_manual=False,
        data_ultima_sincronizacao=_agora(),
        data_ultima_atualizacao=_agora(),
    )
    db.add(lei)
    db.flush()

    versao = LeiVersao(
        lei_id=lei.id, numero_versao=1, hash_conteudo=dados["hash"],
        html_raw=dados["html_raw"], alteracoes_resumo="Importação inicial via URL.",
    )
    db.add(versao)
    db.flush()

    for p in dados["dispositivos"]:
        db.add(Dispositivo(
            lei_id=lei.id, versao_id=versao.id, tipo=p.tipo,
            identificador=p.identificador, texto_conteudo=p.texto_conteudo,
            ordem=p.ordem, ativo=True, status="original",
        ))
    db.commit()
    db.refresh(lei)
    activity.registrar(db, usuario.id, "importar_url", "lei", lei.id, descricao=payload.url)
    return lei


@router.patch("/{lei_id}", response_model=LeiOut)
def editar_metadados(
    lei_id: int,
    payload: LeiUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_editor),
):
    """Edição de metadados — preservada após syncs (apenas campos enviados)."""
    lei = db.get(Lei, lei_id)
    if lei is None:
        raise HTTPException(status_code=404, detail="Lei não encontrada.")
    dados = payload.model_dump(exclude_unset=True)
    for campo, valor in dados.items():
        setattr(lei, campo, valor)
    db.commit()
    db.refresh(lei)
    activity.registrar(db, usuario.id, "editar_lei", "lei", lei.id, descricao=str(list(dados.keys())))
    return lei


@router.delete("/{lei_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_lei(lei_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(get_admin)):
    lei = db.get(Lei, lei_id)
    if lei is None:
        raise HTTPException(status_code=404, detail="Lei não encontrada.")
    db.delete(lei)
    db.commit()
    activity.registrar(db, admin.id, "excluir_lei", "lei", lei_id)


@router.post("/{lei_id}/sincronizar", response_model=LeiOut)
def sincronizar(lei_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(get_editor)):
    lei = db.get(Lei, lei_id)
    if lei is None:
        raise HTTPException(status_code=404, detail="Lei não encontrada.")
    if not lei.url_sincronizacao:
        raise HTTPException(status_code=400, detail="Esta lei não possui URL de sincronização.")
    resultado = sincronizar_lei(db, lei)
    if resultado["status"] == "erro":
        raise HTTPException(status_code=502, detail=resultado["resumo"])
    db.refresh(lei)
    activity.registrar(db, usuario.id, "sincronizar", "lei", lei.id, descricao=resultado["resumo"])
    return lei
