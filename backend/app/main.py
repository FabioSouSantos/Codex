"""Aplicação FastAPI — Codex (gestão de conhecimento legislativo)."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Usuario
from .routers import anotacoes, auth, dispositivos, leis, misc
from .security import hash_senha
from .services.scheduler import shutdown_scheduler, start_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("codex")


def criar_admin_inicial() -> None:
    """Cria o primeiro admin no primeiro startup, via variáveis de ambiente."""
    db = SessionLocal()
    try:
        existe_admin = db.execute(select(Usuario).where(Usuario.papel == "admin")).scalar_one_or_none()
        if existe_admin:
            return
        admin = Usuario(
            nome=settings.admin_nome,
            email=settings.admin_email.lower().strip(),
            senha_hash=hash_senha(settings.admin_password),
            papel="admin",
            ativo=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Admin inicial criado: %s", admin.email)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # NOTA: sem Alembic — create_all roda no startup.
    Base.metadata.create_all(bind=engine)
    criar_admin_inicial()
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="Codex API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # atrás do nginx; ajuste se expor diretamente
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(leis.router)
app.include_router(dispositivos.router)
app.include_router(anotacoes.router)
app.include_router(misc.router)


@app.get("/")
def root():
    return {"app": "Codex", "status": "online"}
