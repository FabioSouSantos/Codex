"""Schemas Pydantic v2."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ----------------------------------------------------------------------------
# Usuários / Auth
# ----------------------------------------------------------------------------
class UsuarioBase(BaseModel):
    nome: str
    email: EmailStr
    papel: str = "viewer"


class UsuarioCreate(UsuarioBase):
    senha: str = Field(min_length=6)


class UsuarioOut(UsuarioBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ativo: bool
    criado_em: datetime


class UsuarioAtivoUpdate(BaseModel):
    ativo: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class TokenData(BaseModel):
    sub: Optional[str] = None


# ----------------------------------------------------------------------------
# Leis
# ----------------------------------------------------------------------------
class LeiBase(BaseModel):
    tipo_norma: str
    numero: Optional[str] = None
    ano: Optional[int] = None
    ementa: Optional[str] = None
    data_publicacao: Optional[date] = None
    veiculo_publicacao: Optional[str] = None
    edicao_dou: Optional[str] = None
    orgao_emanador: Optional[str] = None
    url_sincronizacao: Optional[str] = None
    url_repositorio: Optional[str] = None


class LeiCreate(LeiBase):
    """Cadastro manual — passo 1 (metadados)."""


class LeiUpdate(BaseModel):
    """PATCH de metadados — preservado após syncs."""
    tipo_norma: Optional[str] = None
    numero: Optional[str] = None
    ano: Optional[int] = None
    ementa: Optional[str] = None
    data_publicacao: Optional[date] = None
    veiculo_publicacao: Optional[str] = None
    edicao_dou: Optional[str] = None
    orgao_emanador: Optional[str] = None
    url_sincronizacao: Optional[str] = None
    url_repositorio: Optional[str] = None


class LeiOut(LeiBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cadastro_manual: bool
    data_ultima_sincronizacao: Optional[datetime] = None
    data_ultima_atualizacao: Optional[datetime] = None
    criado_em: datetime


class ImportarUrlIn(BaseModel):
    url: str


class ParseTextoIn(BaseModel):
    texto: str


class LeiManualCompleta(BaseModel):
    """Cadastro manual — passo 2: metadados + texto para parse."""
    metadados: LeiCreate
    texto: str


# ----------------------------------------------------------------------------
# Dispositivos
# ----------------------------------------------------------------------------
class DispositivoBase(BaseModel):
    tipo: str = "artigo"
    identificador: str
    texto_conteudo: str = ""
    ordem: int = 0
    status: str = "original"


class DispositivoCreate(DispositivoBase):
    """Classe SEPARADA — criação de dispositivo."""
    ativo: bool = True


class DispositivoUpdate(BaseModel):
    """Classe SEPARADA — edição parcial de dispositivo."""
    tipo: Optional[str] = None
    identificador: Optional[str] = None
    texto_conteudo: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None
    status: Optional[str] = None


class DispositivoParsePreview(BaseModel):
    tipo: str
    identificador: str
    texto_conteudo: str
    ordem: int


class DispositivoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lei_id: int
    versao_id: Optional[int] = None
    tipo: str
    identificador: str
    texto_conteudo: str
    ordem: int
    ativo: bool
    status: str
    data_inativacao: Optional[datetime] = None


# ----------------------------------------------------------------------------
# Doutrina
# ----------------------------------------------------------------------------
class DoutrinaCreate(BaseModel):
    texto_generico: Optional[str] = None
    comentario_usuario: Optional[str] = None
    autor: Optional[str] = None
    titulo_obra: Optional[str] = None
    edicao: Optional[str] = None
    editora: Optional[str] = None
    cidade: Optional[str] = None
    ano_publicacao: Optional[str] = None
    paginas: Optional[str] = None
    forcar: bool = False  # ignora detecção de duplicata


class DoutrinaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dispositivo_id: int
    usuario_id: int
    texto_generico: Optional[str] = None
    comentario_usuario: Optional[str] = None
    autor: Optional[str] = None
    titulo_obra: Optional[str] = None
    edicao: Optional[str] = None
    editora: Optional[str] = None
    cidade: Optional[str] = None
    ano_publicacao: Optional[str] = None
    paginas: Optional[str] = None
    citacao_abnt_gerada: Optional[str] = None
    criado_em: datetime
    atualizado_em: datetime


# ----------------------------------------------------------------------------
# Jurisprudência
# ----------------------------------------------------------------------------
class JurisprudenciaCreate(BaseModel):
    texto_generico: Optional[str] = None
    tribunal: Optional[str] = None
    tipo_decisao: Optional[str] = None
    numero_processo: Optional[str] = None
    relator: Optional[str] = None
    orgao_julgador: Optional[str] = None
    data_julgamento: Optional[str] = None
    veiculo_publicacao: Optional[str] = None
    forcar: bool = False


class JurisprudenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dispositivo_id: int
    usuario_id: int
    texto_generico: Optional[str] = None
    tribunal: Optional[str] = None
    tipo_decisao: Optional[str] = None
    numero_processo: Optional[str] = None
    relator: Optional[str] = None
    orgao_julgador: Optional[str] = None
    data_julgamento: Optional[str] = None
    veiculo_publicacao: Optional[str] = None
    citacao_abnt_gerada: Optional[str] = None
    criado_em: datetime
    atualizado_em: datetime


# ----------------------------------------------------------------------------
# Comentário pessoal (também usado para links cruzados)
# ----------------------------------------------------------------------------
class ComentarioCreate(BaseModel):
    texto: str


class ComentarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dispositivo_id: int
    usuario_id: int
    texto: str
    criado_em: datetime
    atualizado_em: datetime


# ----------------------------------------------------------------------------
# Dispositivo enriquecido (com anotações) para a página da lei
# ----------------------------------------------------------------------------
class DispositivoCompleto(DispositivoOut):
    doutrinas: list[DoutrinaOut] = []
    jurisprudencias: list[JurisprudenciaOut] = []
    comentarios: list[ComentarioOut] = []  # somente do usuário atual


# ----------------------------------------------------------------------------
# Atualizações recentes (landing page)
# ----------------------------------------------------------------------------
class AtualizacaoRecente(BaseModel):
    tipo: str  # doutrina|jurisprudencia|comentario
    anotacao_id: int
    dispositivo_id: int
    lei_id: int
    lei_titulo: str
    dispositivo_identificador: str
    resumo: str
    criado_em: datetime
