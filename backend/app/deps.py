"""Dependências de autenticação e autorização."""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import Usuario
from .security import decodificar_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

_PAPEL_RANK = {"viewer": 1, "editor": 2, "admin": 3}


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    sub = decodificar_token(token)
    if sub is None:
        raise cred_exc
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise cred_exc
    usuario = db.get(Usuario, user_id)
    if usuario is None or not usuario.ativo:
        raise cred_exc
    return usuario


def exigir_papel(*papeis_permitidos: str):
    """Factory de dependência: exige que o usuário tenha ao menos um dos papéis,
    respeitando a hierarquia admin > editor > viewer."""
    minimo = min(_PAPEL_RANK[p] for p in papeis_permitidos)

    def _checker(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if _PAPEL_RANK.get(usuario.papel, 0) < minimo:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissão insuficiente para esta operação.",
            )
        return usuario

    return _checker


def get_admin(usuario: Usuario = Depends(exigir_papel("admin"))) -> Usuario:
    return usuario


def get_editor(usuario: Usuario = Depends(exigir_papel("editor"))) -> Usuario:
    return usuario
