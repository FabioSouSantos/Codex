"""Endpoints de autenticação e gestão de usuários (cadastro só por admin)."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_admin, get_current_user
from ..models import Usuario
from ..schemas import Token, UsuarioAtivoUpdate, UsuarioCreate, UsuarioOut
from ..security import criar_access_token, hash_senha, verificar_senha
from ..services import activity

router = APIRouter(prefix="/api/auth", tags=["auth"])

PAPEIS_VALIDOS = {"admin", "editor", "viewer"}


@router.post("/token", response_model=Token)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    usuario = db.execute(
        select(Usuario).where(Usuario.email == form.username.lower().strip())
    ).scalar_one_or_none()
    if usuario is None or not verificar_senha(form.password, usuario.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos.")
    if not usuario.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo.")

    token = criar_access_token(sub=str(usuario.id))
    activity.registrar(
        db, usuario.id, "login", "usuario", usuario.id,
        descricao=f"Login de {usuario.email}", ip=request.client.host if request.client else None,
    )
    return Token(access_token=token, usuario=UsuarioOut.model_validate(usuario))


@router.get("/me", response_model=UsuarioOut)
def me(usuario: Usuario = Depends(get_current_user)):
    return usuario


@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db), _: Usuario = Depends(get_admin)):
    return db.execute(select(Usuario).order_by(Usuario.nome)).scalars().all()


@router.post("/usuarios", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def criar_usuario(
    payload: UsuarioCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    if payload.papel not in PAPEIS_VALIDOS:
        raise HTTPException(status_code=422, detail="Papel inválido.")
    email = payload.email.lower().strip()
    existe = db.execute(select(Usuario).where(Usuario.email == email)).scalar_one_or_none()
    if existe:
        raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
    usuario = Usuario(
        nome=payload.nome.strip(),
        email=email,
        senha_hash=hash_senha(payload.senha),
        papel=payload.papel,
        ativo=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    activity.registrar(db, admin.id, "criar_usuario", "usuario", usuario.id, descricao=email)
    return usuario


@router.patch("/usuarios/{usuario_id}/ativo", response_model=UsuarioOut)
def alterar_ativo(
    usuario_id: int,
    payload: UsuarioAtivoUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(get_admin),
):
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if usuario.id == admin.id and not payload.ativo:
        raise HTTPException(status_code=400, detail="Você não pode desativar a si mesmo.")
    usuario.ativo = payload.ativo
    db.commit()
    db.refresh(usuario)
    activity.registrar(
        db, admin.id, "alterar_ativo", "usuario", usuario.id,
        descricao=f"ativo={payload.ativo}",
    )
    return usuario
