"""Scheduler de sincronização diária (APScheduler) às 03h BRT."""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from ..config import settings
from ..database import SessionLocal
from ..models import Lei
from . import sync

logger = logging.getLogger("codex.scheduler")

_scheduler: BackgroundScheduler | None = None


def job_sincronizacao_diaria() -> None:
    logger.info("Iniciando sincronização diária das leis...")
    db = SessionLocal()
    try:
        leis = (
            db.execute(select(Lei).where(Lei.url_sincronizacao.is_not(None)))
            .scalars()
            .all()
        )
        for lei in leis:
            try:
                resultado = sync.sincronizar_lei(db, lei)
                logger.info("Lei %s: %s", lei.id, resultado.get("resumo"))
            except Exception:  # noqa: BLE001
                logger.exception("Erro ao sincronizar lei %s", lei.id)
                db.rollback()
    finally:
        db.close()
    logger.info("Sincronização diária concluída.")


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    _scheduler = BackgroundScheduler(timezone=settings.timezone)
    _scheduler.add_job(
        job_sincronizacao_diaria,
        trigger=CronTrigger(hour=settings.sync_hour_brt, minute=settings.sync_minute),
        id="sync_diaria",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "Scheduler iniciado: sync diária às %02d:%02d (%s)",
        settings.sync_hour_brt,
        settings.sync_minute,
        settings.timezone,
    )
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
