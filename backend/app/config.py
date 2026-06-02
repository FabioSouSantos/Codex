"""Configuração da aplicação via variáveis de ambiente (pydantic-settings)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Banco
    db_host: str = "db"
    db_port: int = 5432
    db_name: str = "lexbase"
    db_user: str = "lexbase"
    db_password: str = "changeme"

    # Segurança / JWT
    secret_key: str = "change-this-secret-key"
    algorithm: str = "HS256"
    token_expire: int = 480  # minutos

    # Admin inicial (criado no primeiro startup)
    admin_email: str = "admin@codex.local"
    admin_password: str = "admin123"
    admin_nome: str = "Administrador"

    # Scheduler
    sync_hour_brt: int = 3  # 03h BRT
    sync_minute: int = 0
    timezone: str = "America/Porto_Velho"  # BRT (UTC-4, Rondônia, sem horário de verão)

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
