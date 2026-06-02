"""Modelos SQLAlchemy 2.0 (mapped_column).

NOTA: O projeto NÃO usa Alembic. Base.metadata.create_all() roda no startup.
Colunas adicionadas após o deploy inicial exigem migration manual via psql.
"""
from __future__ import annotations

from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    papel: Mapped[str] = mapped_column(String(20), default="viewer", nullable=False)  # admin|editor|viewer
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    doutrinas: Mapped[list["Doutrina"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")
    jurisprudencias: Mapped[list["Jurisprudencia"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")
    comentarios: Mapped[list["ComentarioPessoal"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")
    links: Mapped[list["LinkCruzado"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")
    activity_logs: Mapped[list["ActivityLog"]] = relationship(back_populates="usuario")


class Lei(Base):
    __tablename__ = "leis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo_norma: Mapped[str] = mapped_column(String(120), nullable=False)
    numero: Mapped[Optional[str]] = mapped_column(String(60))
    ano: Mapped[Optional[int]] = mapped_column(Integer)
    ementa: Mapped[Optional[str]] = mapped_column(Text)
    data_publicacao: Mapped[Optional[date]] = mapped_column(Date)
    veiculo_publicacao: Mapped[Optional[str]] = mapped_column(String(180))
    edicao_dou: Mapped[Optional[str]] = mapped_column(String(120))
    orgao_emanador: Mapped[Optional[str]] = mapped_column(String(180))
    url_sincronizacao: Mapped[Optional[str]] = mapped_column(String(600))
    url_repositorio: Mapped[Optional[str]] = mapped_column(String(600))
    data_ultima_sincronizacao: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    data_ultima_atualizacao: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    cadastro_manual: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    versoes: Mapped[list["LeiVersao"]] = relationship(
        back_populates="lei", cascade="all, delete-orphan", order_by="LeiVersao.numero_versao"
    )
    dispositivos: Mapped[list["Dispositivo"]] = relationship(
        back_populates="lei", cascade="all, delete-orphan", order_by="Dispositivo.ordem"
    )
    sync_logs: Mapped[list["SyncLog"]] = relationship(back_populates="lei", cascade="all, delete-orphan")


class LeiVersao(Base):
    __tablename__ = "lei_versoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lei_id: Mapped[int] = mapped_column(ForeignKey("leis.id", ondelete="CASCADE"), index=True)
    numero_versao: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    data_criacao: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    hash_conteudo: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    alteracoes_resumo: Mapped[Optional[str]] = mapped_column(Text)
    html_raw: Mapped[Optional[str]] = mapped_column(Text)

    lei: Mapped["Lei"] = relationship(back_populates="versoes")
    dispositivos: Mapped[list["Dispositivo"]] = relationship(back_populates="versao")


class Dispositivo(Base):
    __tablename__ = "dispositivos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lei_id: Mapped[int] = mapped_column(ForeignKey("leis.id", ondelete="CASCADE"), index=True)
    versao_id: Mapped[Optional[int]] = mapped_column(ForeignKey("lei_versoes.id", ondelete="SET NULL"))
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # artigo|paragrafo|inciso|alinea|caput|outro
    identificador: Mapped[str] = mapped_column(String(120), nullable=False)
    texto_conteudo: Mapped[str] = mapped_column(Text, default="")
    ordem: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="original", nullable=False)  # original|alterado|revogado
    data_inativacao: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    lei: Mapped["Lei"] = relationship(back_populates="dispositivos")
    versao: Mapped[Optional["LeiVersao"]] = relationship(back_populates="dispositivos")

    doutrinas: Mapped[list["Doutrina"]] = relationship(back_populates="dispositivo", cascade="all, delete-orphan")
    jurisprudencias: Mapped[list["Jurisprudencia"]] = relationship(
        back_populates="dispositivo", cascade="all, delete-orphan"
    )
    comentarios: Mapped[list["ComentarioPessoal"]] = relationship(
        back_populates="dispositivo", cascade="all, delete-orphan"
    )
    links_origem: Mapped[list["LinkCruzado"]] = relationship(
        back_populates="dispositivo_origem",
        foreign_keys="LinkCruzado.dispositivo_origem_id",
        cascade="all, delete-orphan",
    )


class Doutrina(Base):
    __tablename__ = "doutrinas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dispositivo_id: Mapped[int] = mapped_column(ForeignKey("dispositivos.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    texto_generico: Mapped[Optional[str]] = mapped_column(Text)
    comentario_usuario: Mapped[Optional[str]] = mapped_column(Text)
    autor: Mapped[Optional[str]] = mapped_column(String(255))
    titulo_obra: Mapped[Optional[str]] = mapped_column(String(400))
    edicao: Mapped[Optional[str]] = mapped_column(String(60))
    editora: Mapped[Optional[str]] = mapped_column(String(180))
    cidade: Mapped[Optional[str]] = mapped_column(String(120))
    ano_publicacao: Mapped[Optional[str]] = mapped_column(String(12))
    paginas: Mapped[Optional[str]] = mapped_column(String(60))
    citacao_abnt_gerada: Mapped[Optional[str]] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    dispositivo: Mapped["Dispositivo"] = relationship(back_populates="doutrinas")
    usuario: Mapped["Usuario"] = relationship(back_populates="doutrinas")


class Jurisprudencia(Base):
    __tablename__ = "jurisprudencias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dispositivo_id: Mapped[int] = mapped_column(ForeignKey("dispositivos.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    texto_generico: Mapped[Optional[str]] = mapped_column(Text)
    tribunal: Mapped[Optional[str]] = mapped_column(String(180))
    tipo_decisao: Mapped[Optional[str]] = mapped_column(String(120))
    numero_processo: Mapped[Optional[str]] = mapped_column(String(180))
    relator: Mapped[Optional[str]] = mapped_column(String(180))
    orgao_julgador: Mapped[Optional[str]] = mapped_column(String(180))
    data_julgamento: Mapped[Optional[str]] = mapped_column(String(40))
    veiculo_publicacao: Mapped[Optional[str]] = mapped_column(String(180))
    citacao_abnt_gerada: Mapped[Optional[str]] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    dispositivo: Mapped["Dispositivo"] = relationship(back_populates="jurisprudencias")
    usuario: Mapped["Usuario"] = relationship(back_populates="jurisprudencias")


class ComentarioPessoal(Base):
    __tablename__ = "comentarios_pessoais"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dispositivo_id: Mapped[int] = mapped_column(ForeignKey("dispositivos.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    texto: Mapped[str] = mapped_column(Text, default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    dispositivo: Mapped["Dispositivo"] = relationship(back_populates="comentarios")
    usuario: Mapped["Usuario"] = relationship(back_populates="comentarios")


class LinkCruzado(Base):
    __tablename__ = "links_cruzados"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dispositivo_origem_id: Mapped[int] = mapped_column(
        ForeignKey("dispositivos.id", ondelete="CASCADE"), index=True
    )
    dispositivo_destino_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("dispositivos.id", ondelete="SET NULL")
    )
    lei_destino_id: Mapped[Optional[int]] = mapped_column(ForeignKey("leis.id", ondelete="SET NULL"))
    descricao: Mapped[Optional[str]] = mapped_column(Text)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # back_populates apenas no lado de origem (par com Dispositivo.links_origem).
    dispositivo_origem: Mapped["Dispositivo"] = relationship(
        back_populates="links_origem", foreign_keys=[dispositivo_origem_id]
    )
    # Relações unidirecionais (sem back_populates) — válidas no SQLAlchemy.
    dispositivo_destino: Mapped[Optional["Dispositivo"]] = relationship(
        foreign_keys=[dispositivo_destino_id]
    )
    lei_destino: Mapped[Optional["Lei"]] = relationship(foreign_keys=[lei_destino_id])
    usuario: Mapped["Usuario"] = relationship(back_populates="links", foreign_keys=[usuario_id])


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lei_id: Mapped[int] = mapped_column(ForeignKey("leis.id", ondelete="CASCADE"), index=True)
    data_execucao: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(40), default="ok")  # ok|erro|sem_mudanca
    erro_descricao: Mapped[Optional[str]] = mapped_column(Text)
    mudancas_detectadas: Mapped[bool] = mapped_column(Boolean, default=False)

    lei: Mapped["Lei"] = relationship(back_populates="sync_logs")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    tipo_acao: Mapped[str] = mapped_column(String(60))
    entidade: Mapped[Optional[str]] = mapped_column(String(60))
    entidade_id: Mapped[Optional[int]] = mapped_column(Integer)
    descricao: Mapped[Optional[str]] = mapped_column(Text)
    data_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ip: Mapped[Optional[str]] = mapped_column(String(60))

    usuario: Mapped[Optional["Usuario"]] = relationship(back_populates="activity_logs")
