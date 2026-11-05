"""Notifications: turn Chamber events into short, content-free nudges (in-app + optional email).

Hooked into protocol.emit(), so every state change that needs someone's attention gets one. Text only ever
names the Chamber and what to do next; it never repeats anyone's words or the reason for a safety pause.
"""

import logging
import os
import threading
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import mailer
from .db import SessionLocal, now
from .models import Chamber, Membership, Notification, User

log = logging.getLogger("argumente.notify")
EMAIL_COOLDOWN_MIN = int(os.environ.get("NOTIFY_EMAIL_COOLDOWN_MIN", "30"))

# event type -> (who, title, body). who: "others" (everyone but the actor) or "all".
RULES = {
    "member.joined": ("others", "{actor} joined", "Waiting on positions from everyone."),
    "state.changed:RESTATEMENT": ("all", "Your turn: is this what you mean?", "The Mediator has read everyone's positions."),
    "gate.passed": ("all", "Everyone said 'yes, that's me'", "The Understanding Map is being drawn."),
    "map.generated": ("all", "The Understanding Map is ready", "Read it, then guess again to see your Understanding Score."),
    "state.changed:RESOLUTION": ("all", "Options are ready", "Rank them privately; the combined result appears once everyone has."),
    "ranking.revealed": ("all", "Everyone has ranked", "See how the options landed."),
    "agreement.item.proposed": ("others", "{actor} proposed an agreement item", "It needs your approval or rejection."),
    "chamber.closed": ("others", "{actor} closed the Chamber", "See how it ended."),
    "chamber.paused": ("others", "{actor} paused the Chamber", "Nothing moves until it's resumed."),
    "chamber.resumed": ("others", "{actor} resumed the Chamber", "You can carry on."),
    "preround.openings.revealed": ("all", "Delegate openings are revealed", "Everyone has reviewed their Delegate's turn."),
    "preround.replies.revealed": ("all", "Delegate replies are revealed", "Read what your Delegates said."),
    "engine.run.failed": ("all", "The Mediator couldn't finish", "Open the Chamber to retry."),
}


def dispatch(db: Session, chamber_id: str, type_: str, actor_type: str, actor_id: str | None, payload: dict):
    """Called from emit(). Adds notifications to the session; the caller's commit saves them."""
    key = type_
    if type_ == "state.changed":
        key = f"state.changed:{payload.get('state')}"
    rule = RULES.get(key)
    if not rule:
        return
    # A quiet safety pause (system actor) must not tell anyone anything.
    if type_ in ("chamber.paused", "chamber.resumed") and actor_type != "human":
        return
    who, title, body = rule
    ch = db.get(Chamber, chamber_id)
    if not ch:
        return
    actor = db.get(User, actor_id) if actor_id else None
    names = {"actor": actor.name if actor else "Someone"}
    for m in db.scalars(select(Membership).where(Membership.chamber_id == chamber_id)):
        if who == "others" and m.user_id == actor_id:
            continue
        db.add(
            Notification(
                user_id=m.user_id,
                chamber_id=chamber_id,
                kind=key,
                title=title.format(**names),
                body=f"{ch.title}: {body}",
                link=f"/chambers/{chamber_id}",
            )
        )


def email_pending():
    """Send at most one email per person per cooldown window, summarising their newest unread nudge."""
    if mailer.delivery() != "smtp":
        return 0
    sent = 0
    with SessionLocal() as db:
        cutoff = now() - timedelta(minutes=EMAIL_COOLDOWN_MIN)
        pending = list(db.scalars(select(Notification).where(Notification.emailed_at.is_(None), Notification.read_at.is_(None)).order_by(Notification.created_at)))
        by_user: dict[str, list[Notification]] = {}
        for n in pending:
            by_user.setdefault(n.user_id, []).append(n)
        for uid, ns in by_user.items():
            user = db.get(User, uid)
            if not user or user.notify_email is False:
                for n in ns:
                    n.emailed_at = now()  # opted out: don't keep re-checking
                continue
            last = db.scalars(select(Notification.emailed_at).where(Notification.user_id == uid, Notification.emailed_at.is_not(None)).order_by(Notification.emailed_at.desc())).first()
            if last is not None and (last if last.tzinfo else last.replace(tzinfo=cutoff.tzinfo)) > cutoff:
                continue
            origin = os.environ.get("WEB_ORIGIN", "http://localhost:3000")
            lines = [f"- {n.body}  {origin}{n.link}" for n in ns[-5:]]
            try:
                mailer.send(
                    user.email,
                    ns[-1].title if len(ns) == 1 else f"{len(ns)} things need your attention on Argumenté",
                    "\n".join(lines) + f"\n\nChange these emails any time: {origin}/me",
                )
            except Exception:  # noqa: BLE001
                log.exception("notification email failed")
                continue
            for n in ns:
                n.emailed_at = now()
            sent += 1
        db.commit()
    return sent


def start_worker(interval_seconds: int = 60):
    import time

    def loop():
        while True:
            try:
                email_pending()
            except Exception:  # noqa: BLE001
                log.exception("notification sweep failed")
            time.sleep(interval_seconds)

    threading.Thread(target=loop, daemon=True, name="notify-email").start()
