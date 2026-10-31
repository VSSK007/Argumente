"""Chamber retention (D21): a closed Chamber's private content is deleted 90 days after close,
unless a member extends it. Agreements, the event record (no content) and consented published
snapshots are kept; positions the owner chose to keep in their Delegate are theirs and are kept.
"""

import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import SessionLocal, now
from .models import Chamber, Crux, Intake, Node, Position, PreRoundTurn, Restatement, UnderstandingMap

log = logging.getLogger("argumente.retention")

RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", "90"))


def default_retain_until() -> datetime:
    return now() + timedelta(days=RETENTION_DAYS)


def extended_until(current: datetime | None) -> datetime:
    base = max(_aware(current) or now(), now())
    return base + timedelta(days=RETENTION_DAYS)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def purge_chamber(db: Session, ch: Chamber):
    from .protocol import emit

    for model in (Intake, Node, Restatement, Crux, UnderstandingMap, PreRoundTurn):
        for row in db.scalars(select(model).where(model.chamber_id == ch.id)):
            db.delete(row)
    # Chamber-scoped Delegate memory and suggestions nobody acted on
    for p in db.scalars(select(Position).where(Position.scope_id == ch.id, Position.status.in_(["ENDORSED", "CANDIDATE", "RETRACTED"]))):
        if p.scope_type == "CHAMBER" or p.status == "CANDIDATE":
            db.delete(p)
    ch.options = []
    ch.purged_at = now()
    emit(db, ch.id, "chamber.purged", "system")


def purge_expired(db: Session) -> int:
    n = 0
    t = now()
    for ch in db.scalars(select(Chamber).where(Chamber.state == "CLOSED", Chamber.purged_at.is_(None))):
        ru = _aware(ch.retain_until)
        if ru and ru <= t:
            purge_chamber(db, ch)
            n += 1
    db.commit()
    if n:
        log.info("retention: purged %d chamber(s)", n)
    return n


def start_worker(interval_seconds: int = 6 * 3600):
    def loop():
        while True:
            try:
                with SessionLocal() as db:
                    purge_expired(db)
            except Exception:  # noqa: BLE001
                log.exception("retention sweep failed")
            time.sleep(interval_seconds)

    threading.Thread(target=loop, daemon=True, name="retention").start()
