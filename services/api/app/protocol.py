"""Chamber protocol: state machine, engine runs, and the security-critical retrieval path.

States: INTAKE -> ANALYZING -> RESTATEMENT -> MAPPING -> MAP -> OPTIONS_PENDING -> RESOLUTION -> CLOSED
See docs/ARGUMENTATIVE_INTELLIGENCE.md §3.1.
"""

import logging
import os
import threading
import traceback

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from . import safety
from .db import SessionLocal, now
from .engine import get_engine
from .engine.types import Decomposition, Party
from .models import (
    Chamber,
    ChamberEvent,
    Crux,
    Delegate,
    EngineRun,
    Intake,
    Membership,
    Node,
    Position,
    Restatement,
    UnderstandingMap,
)

log = logging.getLogger("argumente.protocol")

MAX_ENGINE_REVISIONS = 3


class Cancelled(Exception):
    pass


def combine_modes(a: str, b: str) -> str:
    return a if a == b else "mixed"


# --------------------------------------------------------------------------------------
# Invariant 2: the ONLY path by which a Delegate/engine reads a person's stored positions.
# --------------------------------------------------------------------------------------
def scoped_positions(db: Session, delegate_id: str, chamber_id: str | None) -> list[Position]:
    """Endorsed positions a Delegate may use in a given context.

    General positions (PUBLIC/PRIVATE) are usable by the owner's own Delegate everywhere.
    CHAMBER-scoped positions are usable only inside that same Chamber, never elsewhere.
    """
    scope = or_(Position.scope_type.in_(["PUBLIC", "PRIVATE"]))
    if chamber_id:
        scope = or_(scope, (Position.scope_type == "CHAMBER") & (Position.scope_id == chamber_id))
    stmt = select(Position).where(Position.delegate_id == delegate_id, Position.status == "ENDORSED", scope)
    return list(db.scalars(stmt))


def emit(db: Session, chamber_id: str, type_: str, actor_type: str, actor_id: str | None = None, **payload):
    db.add(ChamberEvent(chamber_id=chamber_id, type=type_, actor_type=actor_type, actor_id=actor_id, payload=payload))


def members(db: Session, chamber: Chamber) -> list[Membership]:
    return list(db.scalars(select(Membership).where(Membership.chamber_id == chamber.id).order_by(Membership.joined_at)))


def endorsed_parties(db: Session, chamber: Chamber) -> list[Party]:
    parties = []
    for m in members(db, chamber):
        it = db.scalar(select(Intake).where(Intake.chamber_id == chamber.id, Intake.user_id == m.user_id))
        if it and it.status == "ENDORSED":
            parties.append(Party(party_id=m.user_id, label=m.user.name, text=it.text))
    return parties


# --------------------------------------------------------------------------------------
# Background engine runs
# --------------------------------------------------------------------------------------
def _sync_mode() -> bool:
    return os.environ.get("ENGINE_SYNC") == "1"


def start_run(db: Session, chamber: Chamber, kind: str, target_id: str | None = None) -> EngineRun:
    run = EngineRun(chamber_id=chamber.id, kind=kind, target_id=target_id, step="queued")
    db.add(run)
    emit(db, chamber.id, "engine.run.started", "engine", kind=kind)
    db.commit()
    if _sync_mode():
        _execute(run.id)
    else:
        threading.Thread(target=_execute, args=(run.id,), daemon=True).start()
    return run


def _check_not_paused(db: Session, chamber_id: str):
    db.expire_all()
    ch = db.get(Chamber, chamber_id)
    if ch is None or ch.paused:
        raise Cancelled()


def _step(db: Session, run: EngineRun, label: str):
    run.step = label
    db.commit()
    _check_not_paused(db, run.chamber_id)


def _execute(run_id: str):
    db = SessionLocal()
    try:
        run = db.get(EngineRun, run_id)
        chamber = db.get(Chamber, run.chamber_id)
        handler = {"decompose": _run_decompose, "revise": _run_revise, "map": _run_map, "options": _run_options}[run.kind]
        mode = handler(db, run, chamber)
        run.status = "DONE"
        run.step = "done"
        run.engine_mode = mode
        run.finished_at = now()
        chamber.engine_mode = mode
        emit(db, chamber.id, "engine.run.completed", "engine", kind=run.kind, engine_mode=mode)
        db.commit()
    except Cancelled:
        db.rollback()
        run = db.get(EngineRun, run_id)
        run.status = "CANCELLED"
        run.finished_at = now()
        emit(db, run.chamber_id, "engine.run.cancelled", "engine", kind=run.kind)
        db.commit()
    except Exception as e:  # noqa: BLE001 — surface any failure to the UI as a retryable run
        log.error("engine run %s failed: %s", run_id, traceback.format_exc())
        db.rollback()
        run = db.get(EngineRun, run_id)
        run.status = "FAILED"
        run.error = str(e)[:500]
        run.finished_at = now()
        emit(db, run.chamber_id, "engine.run.failed", "engine", kind=run.kind)
        db.commit()
    finally:
        db.close()


def load_decomposition(db: Session, chamber: Chamber) -> Decomposition:
    """Rebuild the engine's view from stored nodes (so later steps reuse the same graph)."""
    nodes = list(db.scalars(select(Node).where(Node.chamber_id == chamber.id)))
    cruxes = list(db.scalars(select(Crux).where(Crux.chamber_id == chamber.id)))
    return Decomposition(
        claims=[{"party_id": n.holder_id, "text": n.text, "claim_type": n.claim_type or "FACT"} for n in nodes if n.kind == "CLAIM"],
        assumptions=[{"party_id": n.holder_id, "text": n.text} for n in nodes if n.kind == "ASSUMPTION"],
        interests=[{"party_id": n.holder_id, "text": n.text} for n in nodes if n.kind == "INTEREST"],
        shared_values=[n.text for n in nodes if n.kind == "VALUE"],
        disagreements=[{"type": n.claim_type, "summary": n.text, "party_ids": n.party_ids} for n in nodes if n.kind == "DISAGREEMENT"],
        cruxes=[{"party_id": c.party_id, "text": c.text, "question": c.question} for c in cruxes],
    )


def _human_names(parties: list[Party]) -> list[str]:
    return [p.label for p in parties]


def _run_decompose(db: Session, run: EngineRun, chamber: Chamber) -> str:
    engine = get_engine()
    parties = endorsed_parties(db, chamber)
    intake_ids = {
        it.user_id: it.id
        for it in db.scalars(select(Intake).where(Intake.chamber_id == chamber.id, Intake.status == "ENDORSED"))
    }
    texts = {p.party_id: p.text for p in parties}
    _step(db, run, "Reading everyone's positions")
    dec, mode = engine.decompose(chamber.question, parties)
    _step(db, run, "Typing the disagreements")

    # Clear any previous analysis (re-run after resume/retry)
    for model in (Node, Crux, Restatement):
        for row in db.scalars(select(model).where(model.chamber_id == chamber.id)):
            db.delete(row)

    claim_ids: dict[str, list[str]] = {}
    for c in dec.claims:
        # Fabrication guard: a claim is ENDORSED only if it is verbatim in the holder's endorsed text.
        verbatim = c.text.strip().rstrip(".").lower() in texts.get(c.party_id, "").lower()
        n = Node(
            chamber_id=chamber.id,
            kind="CLAIM",
            claim_type=c.claim_type,
            text=c.text,
            holder_id=c.party_id,
            author_type="engine",
            epistemic_status="ENDORSED" if verbatim else "PROPOSED",
            source_intake_ids=[intake_ids[c.party_id]] if c.party_id in intake_ids else [],
            party_ids=[c.party_id],
        )
        db.add(n)
        db.flush()
        claim_ids.setdefault(c.party_id, []).append(n.id)
    for a in dec.assumptions:
        db.add(Node(chamber_id=chamber.id, kind="ASSUMPTION", text=a.text, holder_id=a.party_id, epistemic_status="INFERRED", party_ids=[a.party_id], confidence=0.5))
    for i in dec.interests:
        db.add(Node(chamber_id=chamber.id, kind="INTEREST", text=i.text, holder_id=i.party_id, epistemic_status="INFERRED", party_ids=[i.party_id], confidence=0.6))
    for v in dec.shared_values:
        db.add(Node(chamber_id=chamber.id, kind="VALUE", text=v, epistemic_status="PROPOSED", party_ids=[p.party_id for p in parties]))
    for d in dec.disagreements:
        db.add(Node(chamber_id=chamber.id, kind="DISAGREEMENT", claim_type=d.type, text=d.summary, epistemic_status="PROPOSED", party_ids=d.party_ids))
    for c in dec.cruxes:
        db.add(Crux(chamber_id=chamber.id, party_id=c.party_id, text=c.text, question=c.question))
    db.flush()

    _step(db, run, "Restating each view for the group")
    names = _human_names(parties)
    for p in parties:
        claims = [c.text for c in dec.claims if c.party_id == p.party_id]
        out, rmode = engine.restate(chamber.question, p, claims)
        mode = combine_modes(mode, rmode)
        db.add(
            Restatement(
                chamber_id=chamber.id,
                of_user_id=p.party_id,
                text=safety.check_output(out.text, names),
                source_node_ids=claim_ids.get(p.party_id, []),
            )
        )
    _check_not_paused(db, chamber.id)
    chamber = db.get(Chamber, chamber.id)
    chamber.state = "RESTATEMENT"
    emit(db, chamber.id, "state.changed", "engine", state="RESTATEMENT")
    return mode


def _run_revise(db: Session, run: EngineRun, chamber: Chamber) -> str:
    engine = get_engine()
    rst = db.get(Restatement, run.target_id)
    parties = {p.party_id: p for p in endorsed_parties(db, chamber)}
    party = parties[rst.of_user_id]
    claims = [n.text for n in db.scalars(select(Node).where(Node.chamber_id == chamber.id, Node.kind == "CLAIM", Node.holder_id == party.party_id))]
    _step(db, run, f"Revising how {party.label}'s view is explained")
    out, mode = engine.restate(chamber.question, party, claims, previous=rst.text, feedback=rst.feedback)
    _check_not_paused(db, chamber.id)
    rst = db.get(Restatement, run.target_id)
    rst.text = safety.check_output(out.text, [p.label for p in parties.values()])
    rst.revision += 1
    rst.status = "PENDING"
    emit(db, chamber.id, "restatement.created", "engine", restatement_id=rst.id, revision=rst.revision)
    return mode


def _run_map(db: Session, run: EngineRun, chamber: Chamber) -> str:
    engine = get_engine()
    parties = endorsed_parties(db, chamber)
    dec = load_decomposition(db, chamber)
    _step(db, run, "Drawing the Understanding Map")
    out, mode = engine.render_map(chamber.question, parties, dec)
    _check_not_paused(db, chamber.id)
    restatements = {r.of_user_id: r for r in db.scalars(select(Restatement).where(Restatement.chamber_id == chamber.id))}
    cruxes = list(db.scalars(select(Crux).where(Crux.chamber_id == chamber.id)))
    names = [p.label for p in parties]
    content = {
        "headline": out.headline,
        "summary": safety.check_output(out.summary, names),
        # "Where you stand" is built ONLY from restatements each person accepted (invariant 3).
        "where_you_stand": [
            {
                "party_id": p.party_id,
                "text": restatements[p.party_id].text,
                "restatement_id": restatements[p.party_id].id,
                "epistemic_status": "ENDORSED",
            }
            for p in parties
            if p.party_id in restatements and restatements[p.party_id].status == "ACCEPTED"
        ],
        "shared": out.shared,
        "differences": [d.model_dump() for d in out.differences],
        "cruxes": [
            {"party_id": c.party_id, "text": c.text, "confirmed": c.confirmed}
            for c in cruxes
            if c.confirmed is not False
        ],
        "open_questions": out.open_questions,
        "engine_mode": mode,
    }
    prev = db.scalars(select(UnderstandingMap).where(UnderstandingMap.chamber_id == chamber.id).order_by(UnderstandingMap.version.desc())).first()
    db.add(UnderstandingMap(chamber_id=chamber.id, content=content, version=(prev.version + 1) if prev else 1))
    chamber = db.get(Chamber, chamber.id)
    chamber.state = "MAP"
    emit(db, chamber.id, "map.generated", "engine")
    emit(db, chamber.id, "state.changed", "engine", state="MAP")
    return mode


def _run_options(db: Session, run: EngineRun, chamber: Chamber) -> str:
    engine = get_engine()
    parties = endorsed_parties(db, chamber)
    dec = load_decomposition(db, chamber)
    _step(db, run, "Looking for options that serve everyone's stakes")
    out, mode = engine.options(chamber.question, parties, dec)
    _check_not_paused(db, chamber.id)
    chamber = db.get(Chamber, chamber.id)
    chamber.options = [o.model_dump() for o in out.options]
    chamber.state = "RESOLUTION"
    emit(db, chamber.id, "state.changed", "engine", state="RESOLUTION")
    return mode


def resume_pending_run(db: Session, chamber: Chamber):
    """After resume: restart the step that a pause cancelled."""
    kind = {"ANALYZING": "decompose", "MAPPING": "map", "OPTIONS_PENDING": "options"}.get(chamber.state)
    if kind:
        start_run(db, chamber, kind)
    for rst in db.scalars(select(Restatement).where(Restatement.chamber_id == chamber.id, Restatement.status == "REVISING")):
        start_run(db, chamber, "revise", target_id=rst.id)


def delegate_for(db: Session, user_id: str) -> Delegate | None:
    return db.scalar(select(Delegate).where(Delegate.owner_id == user_id))
