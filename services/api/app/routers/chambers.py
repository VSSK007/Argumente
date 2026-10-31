import asyncio
import json
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import protocol, ratelimit, retention, safety
from ..auth import current_user, human_user, make_ticket, read_ticket
from ..cards import TEMPLATES
from ..db import SessionLocal, get_db, now
from ..engine import get_engine
from ..models import (
    AgreementItem,
    Approval,
    Chamber,
    ChamberEvent,
    Crux,
    EngineRun,
    Intake,
    Membership,
    Node,
    OptionRanking,
    Position,
    Prediction,
    PreRoundTurn,
    Publication,
    PublicationConsent,
    Restatement,
    SafetyFlag,
    UnderstandingMap,
    User,
)

router = APIRouter(tags=["chambers"])

MAX_MEMBERS = 8


def err(status: int, code: str, message: str):
    raise HTTPException(status, {"code": code, "message": message})


def _alias(i: int) -> str:
    return f"Participant {chr(ord('A') + i)}"


def _chamber_for_member(cid: str, user: User, db: Session) -> tuple[Chamber, Membership]:
    ch = db.get(Chamber, cid)
    if not ch:
        err(404, "NOT_FOUND", "Chamber not found.")
    m = db.scalar(select(Membership).where(Membership.chamber_id == cid, Membership.user_id == user.id))
    if not m:
        err(403, "NOT_A_MEMBER", "You're not part of this Chamber.")
    return ch, m


def _require_active(ch: Chamber):
    if ch.paused:
        err(409, "PAUSED", "This Chamber is paused. Resume it to continue.")
    if ch.state == "CLOSED":
        err(409, "CLOSED", "This Chamber is closed.")


# ----------------------------------------------------------------------------- view
def chamber_view(ch: Chamber, me: User, db: Session) -> dict:
    db.expire_all()  # engine runs write through their own sessions
    mems = protocol.members(db, ch)
    intakes = {i.user_id: i for i in db.scalars(select(Intake).where(Intake.chamber_id == ch.id))}
    names = {m.user_id: m.user.name for m in mems}
    show_analysis = ch.state not in ("INTAKE", "ANALYZING")

    members_out = []
    for m in mems:
        d = protocol.delegate_for(db, m.user_id)
        it = intakes.get(m.user_id)
        members_out.append(
            {
                "user_id": m.user_id,
                "name": m.user.name,
                "alias": m.alias,
                "role": m.role,
                "is_me": m.user_id == me.id,
                "delegate": {"handle": d.handle, "name": d.name, "glyph_seed": d.glyph_seed} if d else None,
                "intake_status": it.status if it else "NONE",
            }
        )
    mine = intakes.get(me.id)

    nodes = list(db.scalars(select(Node).where(Node.chamber_id == ch.id))) if show_analysis else []
    restatements = list(db.scalars(select(Restatement).where(Restatement.chamber_id == ch.id))) if show_analysis else []
    cruxes = list(db.scalars(select(Crux).where(Crux.chamber_id == ch.id))) if show_analysis else []
    latest_map = db.scalars(
        select(UnderstandingMap).where(UnderstandingMap.chamber_id == ch.id).order_by(UnderstandingMap.version.desc())
    ).first()
    run = db.scalars(select(EngineRun).where(EngineRun.chamber_id == ch.id).order_by(EngineRun.created_at.desc())).first()

    items = list(db.scalars(select(AgreementItem).where(AgreementItem.chamber_id == ch.id).order_by(AgreementItem.created_at)))
    approvals = {}
    for a in db.scalars(select(Approval).where(Approval.item_id.in_([i.id for i in items]))) if items else []:
        approvals.setdefault(a.item_id, {})[a.user_id] = a.decision
    member_ids = [m.user_id for m in mems]

    agreement_items = [i for i in items if (i.kind or "agreement") == "agreement"]

    def item_status(iid):
        ds = approvals.get(iid, {})
        if any(v == "reject" for v in ds.values()):
            return "REJECTED"
        if all(ds.get(u) == "approve" for u in member_ids):
            return "APPROVED"
        return "PENDING"

    pub = db.scalar(select(Publication).where(Publication.chamber_id == ch.id))
    consents = {c.user_id: c for c in db.scalars(select(PublicationConsent).where(PublicationConsent.publication_id == pub.id))} if pub else {}
    flag = db.scalar(
        select(SafetyFlag).where(SafetyFlag.chamber_id == ch.id, SafetyFlag.user_id == me.id, SafetyFlag.dismissed.is_(False))
    )
    events = list(db.scalars(select(ChamberEvent).where(ChamberEvent.chamber_id == ch.id).order_by(ChamberEvent.id.desc()).limit(30)))

    return {
        "preround": preround_view(db, ch, me, mems),
        "lineage": lineage_view(db, ch, me),
        "ranking": ranking_view(db, ch, me, mems),
        "predictions": prediction_view(db, ch, me),
        "retention": {
            "retain_until": retention._aware(ch.retain_until).isoformat() if ch.retain_until else None,
            "purged": ch.purged_at is not None,
        },
        "id": ch.id,
        "title": ch.title,
        "question": ch.question,
        "template": ch.template,
        "template_prompt": TEMPLATES.get(ch.template, {}).get("prompt"),
        "state": ch.state,
        "paused": ch.paused,
        "paused_by": names.get(ch.paused_by) if ch.paused_by else None,
        "closed_state": ch.closed_state,
        "invite_token": ch.invite_token,
        "is_creator": ch.creator_id == me.id,
        "engine_mode": ch.engine_mode,
        "members": members_out,
        "my_intake": {"text": mine.text, "status": mine.status, "authored_by": mine.authored_by} if mine else None,
        "graph": {
            "nodes": [
                {
                    "id": n.id,
                    "kind": n.kind,
                    "claim_type": n.claim_type,
                    "text": n.text,
                    "holder_id": n.holder_id,
                    "holder_name": names.get(n.holder_id),
                    "epistemic_status": n.epistemic_status,
                    "party_ids": n.party_ids,
                }
                for n in nodes
            ]
        },
        "restatements": [
            {
                "id": r.id,
                "of_user_id": r.of_user_id,
                "of_name": names.get(r.of_user_id),
                "text": r.text,
                "status": r.status,
                "revision": r.revision,
                "feedback": r.feedback if r.of_user_id == me.id else None,
                "written_by": r.written_by,
                "is_mine": r.of_user_id == me.id,
                "can_write_own": r.of_user_id == me.id and r.revision >= protocol.MAX_ENGINE_REVISIONS,
            }
            for r in restatements
        ],
        "cruxes": [
            {
                "id": c.id,
                "party_id": c.party_id,
                "party_name": names.get(c.party_id),
                "text": c.text,
                "question": c.question if c.party_id == me.id else None,
                "confirmed": c.confirmed,
                "is_mine": c.party_id == me.id,
            }
            for c in cruxes
        ],
        "map": latest_map.content if latest_map and ch.state in ("MAP", "OPTIONS_PENDING", "RESOLUTION", "CLOSED") else None,
        "options": ch.options,
        "agreement": {
            "items": [
                {
                    "id": i.id,
                    "text": i.text,
                    "proposed_by_type": i.proposed_by_type,
                    "proposed_by_name": names.get(i.proposed_by_id) if i.proposed_by_id else None,
                    "decisions": approvals.get(i.id, {}),
                    "my_decision": approvals.get(i.id, {}).get(me.id),
                    "status": item_status(i.id),
                    "kind": i.kind or "agreement",
                }
                for i in items
            ],
            "all_approved": bool(agreement_items) and all(item_status(i.id) == "APPROVED" for i in agreement_items),
        },
        "publication": {
            "status": pub.status,
            "slug": pub.slug,
            "consents": {uid: {"consent": c.consent, "show_name": c.show_name} for uid, c in consents.items()},
            "my_consent": consents[me.id].consent if me.id in consents else None,
        }
        if pub
        else None,
        "run": {"kind": run.kind, "status": run.status, "step": run.step, "error": run.error, "engine_mode": run.engine_mode} if run else None,
        "safety": {"category": flag.category, **safety.RESOURCES} if flag else None,
        "events": [
            {"id": e.id, "type": e.type, "actor_type": e.actor_type, "actor_name": names.get(e.actor_id), "payload": e.payload, "at": e.created_at.isoformat()}
            for e in events
        ],
    }


def _has_revisit(db: Session, ch: Chamber) -> bool:
    return db.scalar(select(Chamber.id).where(Chamber.parent_id == ch.id)) is not None


def prediction_view(db: Session, ch: Chamber, me: User) -> dict:
    """Predictions are sealed until the Chamber is revisited; then everyone's are shown side by side."""
    names = {m.user_id: m.user.name for m in protocol.members(db, ch)}
    rows = list(db.scalars(select(Prediction).where(Prediction.chamber_id == ch.id).order_by(Prediction.created_at)))
    unsealed = _has_revisit(db, ch)
    mine = next((p for p in rows if p.user_id == me.id), None)

    def out(p: Prediction) -> dict:
        return {
            "id": p.id,
            "name": names.get(p.user_id, "Former member"),
            "is_mine": p.user_id == me.id,
            "text": p.text,
            "confidence": p.confidence,
            "verdict": p.verdict,
            "review_note": p.review_note,
        }

    return {
        "sealed": not unsealed,
        "count": len(rows),
        "mine": out(mine) if mine else None,
        "all": [out(p) for p in rows] if unsealed else None,
    }


def ranking_view(db: Session, ch: Chamber, me: User, mems: list[Membership]) -> dict:
    rows = {r.user_id: r for r in db.scalars(select(OptionRanking).where(OptionRanking.chamber_id == ch.id))}
    n_opts = len(ch.options or [])
    complete = bool(n_opts) and all(m.user_id in rows for m in mems)
    results = None
    if complete:
        # Borda count: top choice earns n-1 points, last earns 0. Individual rankings stay private.
        results = []
        for i, opt in enumerate(ch.options):
            positions = [r.order.index(i) for r in rows.values()]
            results.append(
                {
                    "index": i,
                    "title": opt["title"],
                    "points": sum(n_opts - 1 - p for p in positions),
                    "max_points": (n_opts - 1) * len(rows),
                    "first_choices": sum(p == 0 for p in positions),
                    "last_choices": sum(p == n_opts - 1 for p in positions) if n_opts > 1 else 0,
                }
            )
        results.sort(key=lambda r: (-r["points"], r["last_choices"]))
    return {
        "ranked_user_ids": list(rows.keys()),
        "mine": rows[me.id].order if me.id in rows else None,
        "complete": complete,
        "results": results,
    }


def lineage_view(db: Session, ch: Chamber, me: User) -> dict:
    """Earlier and later Chambers on the same question. Only people who were in the earlier
    Chamber see what it concluded."""
    parent = None
    if ch.parent_id:
        p = db.get(Chamber, ch.parent_id)
        was_member = p and db.scalar(select(Membership).where(Membership.chamber_id == p.id, Membership.user_id == me.id))
        if p and was_member:
            approved = []
            for it in db.scalars(select(AgreementItem).where(AgreementItem.chamber_id == p.id)):
                ds = [a.decision for a in db.scalars(select(Approval).where(Approval.item_id == it.id))]
                n = len(protocol.members(db, p))
                if len(ds) == n and all(d == "approve" for d in ds):
                    approved.append({"text": it.text, "kind": it.kind or "agreement"})
            parent = {
                "id": p.id,
                "title": p.title,
                "closed_state": p.closed_state,
                "closed_at": p.closed_at.isoformat() if p.closed_at else None,
                "approved": approved,
                "predictions": prediction_view(db, p, me),
            }
    revisits = [{"id": c.id, "title": c.title, "state": c.state} for c in db.scalars(select(Chamber).where(Chamber.parent_id == ch.id))]
    return {"parent": parent, "revisits": revisits}


def preround_view(db: Session, ch: Chamber, me: User, mems: list[Membership]) -> dict:
    participants = protocol.preround_participants(db, ch)
    turns = protocol.preround_turns(db, ch.id)
    openings = [t for t in turns if t.kind == "opening"]
    replies = [t for t in turns if t.kind == "reply"]
    if not openings:
        phase = "none"
    elif not protocol.phase_settled(openings):
        phase = "openings"
    elif not replies:
        phase = "replies_pending" if sum(t.status == "RELEASED" for t in openings) >= 2 else "done"
    elif not protocol.phase_settled(replies):
        phase = "replies"
    else:
        phase = "done"
    revealed = {"opening": protocol.phase_settled(openings), "reply": protocol.phase_settled(replies)}
    names = {m.user_id: m.user.name for m in mems}
    visible = []
    for t in turns:
        mine = t.owner_id == me.id
        # Others' turns are hidden until released AND every participant has reviewed theirs (simultaneous reveal).
        if not mine and not (t.status == "RELEASED" and revealed[t.kind]):
            continue
        d = protocol.delegate_for(db, t.owner_id)
        visible.append(
            {
                "id": t.id,
                "owner_id": t.owner_id,
                "owner_name": names.get(t.owner_id),
                "delegate": {"name": d.name, "glyph_seed": d.glyph_seed, "handle": d.handle} if d else None,
                "kind": t.kind,
                "text": t.text,
                "status": t.status,
                "authored_by": t.authored_by,
                "unknowns": t.unknowns if mine else [],
                "is_mine": mine,
            }
        )
    return {
        "phase": phase,
        "participant_ids": [m.user_id for m, _ in participants],
        "can_start": ch.state == "INTAKE" and not openings and len(participants) >= 2,
        "pending": {
            k: [names.get(t.owner_id) for t in ts if t.status == "DRAFT"] for k, ts in (("opening", openings), ("reply", replies))
        },
        "turns": visible,
    }


# ----------------------------------------------------------------------------- create / list / join
@router.get("/templates")
def templates():
    return TEMPLATES


class ChamberIn(BaseModel):
    template: str = Field(pattern="^(decision|disagreement|household)$")  # couple template deferred (D6)
    title: str = Field(min_length=2, max_length=120)
    question: str = Field(min_length=5, max_length=600)


@router.post("/chambers")
def create_chamber(body: ChamberIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ratelimit.check(user.id, "create")
    ch = Chamber(creator_id=user.id, template=body.template, title=body.title.strip(), question=body.question.strip(), invite_token=secrets.token_urlsafe(12))
    db.add(ch)
    db.flush()
    db.add(Membership(chamber_id=ch.id, user_id=user.id, role="creator", alias=_alias(0)))
    protocol.emit(db, ch.id, "chamber.created", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


@router.get("/chambers")
def list_chambers(user: User = Depends(current_user), db: Session = Depends(get_db)):
    out = []
    for m in db.scalars(select(Membership).where(Membership.user_id == user.id).order_by(Membership.joined_at.desc())):
        ch = db.get(Chamber, m.chamber_id)
        mems = protocol.members(db, ch)
        mine = db.scalar(select(Intake).where(Intake.chamber_id == ch.id, Intake.user_id == user.id))
        pending_restatement = db.scalar(
            select(Restatement).where(Restatement.chamber_id == ch.id, Restatement.of_user_id == user.id, Restatement.status == "PENDING")
        )
        needs_you = None
        if ch.paused:
            needs_you = None
        elif ch.state == "INTAKE" and (not mine or mine.status != "ENDORSED"):
            needs_you = "Add your position"
        elif ch.state == "RESTATEMENT" and pending_restatement:
            needs_you = "Check how your view was explained"
        elif ch.state == "RESOLUTION":
            needs_you = "Review the options and agreement"
        out.append(
            {
                "id": ch.id,
                "title": ch.title,
                "question": ch.question,
                "template": ch.template,
                "state": ch.state,
                "paused": ch.paused,
                "closed_state": ch.closed_state,
                "member_names": [x.user.name for x in mems],
                "needs_you": needs_you,
                "created_at": ch.created_at.isoformat(),
            }
        )
    return out


@router.get("/chambers/{cid}")
def get_chamber(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    return chamber_view(ch, user, db)


@router.get("/chambers/{cid}/events")
def chamber_events(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Full event record (oldest first) for the timeline. Payloads carry no private content."""
    ch, _ = _chamber_for_member(cid, user, db)
    names = {m.user_id: m.user.name for m in protocol.members(db, ch)}
    rows = db.scalars(select(ChamberEvent).where(ChamberEvent.chamber_id == cid).order_by(ChamberEvent.id).limit(1000))
    return [
        {"id": e.id, "type": e.type, "actor_type": e.actor_type, "actor_name": names.get(e.actor_id), "payload": e.payload, "at": e.created_at.isoformat()}
        for e in rows
    ]


@router.post("/chambers/{cid}/stream-ticket")
def stream_ticket(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """A 60-second, Chamber-scoped ticket for opening the event stream (EventSource can't send headers)."""
    _chamber_for_member(cid, user, db)
    return {"ticket": make_ticket(user.id, f"stream:{cid}"), "expires_in": 60}


@router.get("/chambers/{cid}/stream")
async def stream(cid: str, request: Request, ticket: str):
    """Server-sent events: a 'change' event whenever anything in the Chamber changes.

    Carries no content (only event ids and types); clients refetch the authorized view.
    Authenticated with a short-lived ticket from /stream-ticket, never the session token.
    """
    user_id = read_ticket(ticket, f"stream:{cid}")
    with SessionLocal() as db:
        if not user_id or not db.scalar(select(Membership).where(Membership.chamber_id == cid, Membership.user_id == user_id)):
            err(403, "BAD_TICKET", "Stream ticket is invalid or expired.")

    def snapshot(db) -> tuple[int, tuple]:
        last = db.scalar(select(ChamberEvent.id).where(ChamberEvent.chamber_id == cid).order_by(ChamberEvent.id.desc())) or 0
        run = db.scalars(select(EngineRun).where(EngineRun.chamber_id == cid).order_by(EngineRun.created_at.desc())).first()
        return last, (run.id, run.status, run.step) if run else ()

    async def events():
        with SessionLocal() as db:
            last, run_sig = snapshot(db)
        yield "retry: 3000\nevent: hello\ndata: {}\n\n"
        idle = 0.0
        while not await request.is_disconnected():
            await asyncio.sleep(0.5)
            idle += 0.5
            with SessionLocal() as db:
                rows = db.execute(
                    select(ChamberEvent.id, ChamberEvent.type).where(ChamberEvent.chamber_id == cid, ChamberEvent.id > last).order_by(ChamberEvent.id)
                ).all()
                _, new_run_sig = snapshot(db)
            for eid, etype in rows:
                last = eid
                yield f"event: change\ndata: {json.dumps({'id': eid, 'type': etype})}\n\n"
                idle = 0.0
            if new_run_sig != run_sig:
                run_sig = new_run_sig
                yield f"event: change\ndata: {json.dumps({'type': 'engine.progress'})}\n\n"
                idle = 0.0
            if idle >= 15:
                yield ": ping\n\n"
                idle = 0.0

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})


@router.get("/invites/{token}")
def invite_preview(token: str, db: Session = Depends(get_db)):
    ch = db.scalar(select(Chamber).where(Chamber.invite_token == token))
    if not ch:
        err(404, "NOT_FOUND", "This invite link isn't valid.")
    creator = db.get(User, ch.creator_id)
    return {
        "chamber_id": ch.id,
        "title": ch.title,
        "question": ch.question,
        "template": ch.template,
        "creator_name": creator.name if creator else None,
        "member_count": len(protocol.members(db, ch)),
        "open": ch.state == "INTAKE",
    }


@router.post("/invites/{token}/accept")
def accept_invite(token: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch = db.scalar(select(Chamber).where(Chamber.invite_token == token))
    if not ch:
        err(404, "NOT_FOUND", "This invite link isn't valid.")
    existing = db.scalar(select(Membership).where(Membership.chamber_id == ch.id, Membership.user_id == user.id))
    if existing:
        return {"chamber_id": ch.id}
    if ch.state != "INTAKE":
        err(409, "CLOSED_TO_NEW", "This Chamber has already moved past the intake stage.")
    mems = protocol.members(db, ch)
    if len(mems) >= MAX_MEMBERS:
        err(409, "FULL", f"Chambers are limited to {MAX_MEMBERS} people.")
    # Guests can join without a Delegate (D19).
    db.add(Membership(chamber_id=ch.id, user_id=user.id, role="participant", alias=_alias(len(mems))))
    protocol.emit(db, ch.id, "member.joined", "human", user.id)
    db.commit()
    return {"chamber_id": ch.id}


# ----------------------------------------------------------------------------- intake
class IntakeIn(BaseModel):
    text: str = Field(min_length=3, max_length=4000)
    endorse: bool = False


def _screen_and_maybe_pause(db: Session, ch: Chamber, user: User, text: str) -> bool:
    category = safety.screen(text)
    if not category:
        return False
    db.add(SafetyFlag(user_id=user.id, chamber_id=ch.id, category=category))
    ch.paused = True
    ch.paused_by = None  # quiet pause: others just see "paused"
    protocol.emit(db, ch.id, "chamber.paused", "system")
    return True


@router.post("/chambers/{cid}/intake")
def submit_intake(cid: str, body: IntakeIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    _require_active(ch)
    if ch.state != "INTAKE":
        err(409, "WRONG_STATE", "Positions can only be changed during intake.")
    it = db.scalar(select(Intake).where(Intake.chamber_id == ch.id, Intake.user_id == user.id))
    text = body.text.strip()
    if it:
        if it.text != text:
            it.authored_by = "human"  # once the person edits, it's in their own words
        it.text = text
    else:
        it = Intake(chamber_id=ch.id, user_id=user.id, text=text, authored_by="human")
        db.add(it)
    it.status = "ENDORSED" if body.endorse else "DRAFT"
    flagged = _screen_and_maybe_pause(db, ch, user, text)
    if body.endorse:
        protocol.emit(db, ch.id, "position.endorsed", "human", user.id)
        _remember_in_delegate(db, ch, user, text)
    db.commit()
    return {**chamber_view(ch, user, db), "safety_paused": flagged}


def _remember_in_delegate(db: Session, ch: Chamber, user: User, text: str):
    """Store the endorsed position as Chamber-scoped Delegate memory (never visible elsewhere)."""
    d = protocol.delegate_for(db, user.id)
    if not d:
        return
    p = db.scalar(select(Position).where(Position.delegate_id == d.id, Position.scope_type == "CHAMBER", Position.scope_id == ch.id))
    if p:
        p.statement = text
        p.status = "ENDORSED"
        p.history = [*p.history, {"at": now().isoformat(), "event": "re-endorsed in Chamber"}]
    else:
        db.add(
            Position(
                delegate_id=d.id,
                statement=text,
                topic=ch.title,
                status="ENDORSED",
                scope_type="CHAMBER",
                scope_id=ch.id,
                source=f"CHAMBER:{ch.title}",
                history=[{"at": now().isoformat(), "event": f"endorsed in Chamber “{ch.title}”"}],
            )
        )


@router.post("/chambers/{cid}/delegate-draft")
def delegate_draft(cid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """The caller's own Delegate drafts their intake from endorsed positions. Stays DRAFT until endorsed."""
    ch, _ = _chamber_for_member(cid, user, db)
    _require_active(ch)
    if ch.state != "INTAKE":
        err(409, "WRONG_STATE", "Drafting is only available during intake.")
    d = protocol.delegate_for(db, user.id)
    if not d:
        err(400, "NO_DELEGATE", "Create a Delegate first, or write your position yourself.")
    ratelimit.check(user.id, "engine")
    if d.autonomy == "L0" or d.status == "PAUSED":
        err(400, "DELEGATE_SILENT", "Your Delegate is paused or set to silent.")
    positions = [
        {"id": p.id, "statement": p.statement, "stance": p.stance}
        for p in protocol.scoped_positions(db, d.id, ch.id)
    ]
    out, mode = get_engine().draft_position(ch.question, user.name, positions)
    if not out.text.strip():
        return {"drafted": False, "unknowns": out.unknowns, "engine_mode": mode}
    it = db.scalar(select(Intake).where(Intake.chamber_id == ch.id, Intake.user_id == user.id))
    if it:
        it.text, it.status, it.authored_by = out.text, "DRAFT", "delegate"
    else:
        db.add(Intake(chamber_id=ch.id, user_id=user.id, text=out.text, status="DRAFT", authored_by="delegate"))
    protocol.emit(db, ch.id, "position.drafted", "delegate", user.id)
    db.commit()
    return {"drafted": True, "unknowns": out.unknowns, "engine_mode": mode, "used_position_ids": out.used_position_ids}


# ----------------------------------------------------------------------------- Delegate pre-round
@router.post("/chambers/{cid}/preround/start")
def start_preround(cid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    _require_active(ch)
    if ch.state != "INTAKE":
        err(409, "WRONG_STATE", "The pre-round happens before analysis.")
    if protocol.preround_turns(db, ch.id):
        err(409, "ALREADY_STARTED", "A pre-round has already run in this Chamber.")
    if len(protocol.preround_participants(db, ch)) < 2:
        err(409, "GATE_NOT_SATISFIED", "A pre-round needs at least two people with active Delegates.")
    ratelimit.check(user.id, "engine")
    protocol.emit(db, ch.id, "preround.started", "human", user.id)
    db.commit()
    protocol.start_run(db, ch, "preround_openings")
    return chamber_view(ch, user, db)


class ReleaseIn(BaseModel):
    text: str = Field(min_length=3, max_length=3000)


def _own_turn(tid: str, user: User, db: Session) -> tuple[PreRoundTurn, Chamber]:
    t = db.get(PreRoundTurn, tid)
    if not t:
        err(404, "NOT_FOUND", "Turn not found.")
    ch, _ = _chamber_for_member(t.chamber_id, user, db)
    if t.owner_id != user.id:
        err(403, "NOT_YOURS", "Only the Delegate's owner can release or withdraw its turns.")
    _require_active(ch)
    if ch.state != "INTAKE":
        err(409, "WRONG_STATE", "The pre-round is over.")
    if t.status != "DRAFT":
        err(409, "ALREADY_DECIDED", "You've already decided on this turn.")
    return t, ch


def _after_turn_decision(db: Session, ch: Chamber, kind: str):
    turns = protocol.preround_turns(db, ch.id, kind)
    if kind == "opening" and protocol.phase_settled(turns):
        protocol.emit(db, ch.id, "preround.openings.revealed", "system")
        db.commit()
        if sum(t.status == "RELEASED" for t in turns) >= 2:
            protocol.start_run(db, ch, "preround_replies")
    elif kind == "reply" and protocol.phase_settled(turns):
        protocol.emit(db, ch.id, "preround.replies.revealed", "system")
        db.commit()


@router.post("/preround-turns/{tid}/release")
def release_turn(tid: str, body: ReleaseIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """The owner reviews (and may rewrite) their Delegate's turn before anyone else can see it."""
    t, ch = _own_turn(tid, user, db)
    text = body.text.strip()
    if text != t.text:
        t.authored_by = "human"
    t.text = safety.check_output(text, [user.name])
    t.status = "RELEASED"
    flagged = _screen_and_maybe_pause(db, ch, user, text)
    protocol.emit(db, ch.id, f"preround.{t.kind}.released", "human", user.id)
    db.commit()
    if not flagged:
        _after_turn_decision(db, ch, t.kind)
    return chamber_view(ch, user, db)


@router.post("/preround-turns/{tid}/withdraw")
def withdraw_turn(tid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    t, ch = _own_turn(tid, user, db)
    t.status = "WITHDRAWN"
    protocol.emit(db, ch.id, f"preround.{t.kind}.withdrawn", "human", user.id)
    db.commit()
    _after_turn_decision(db, ch, t.kind)
    return chamber_view(ch, user, db)


# ----------------------------------------------------------------------------- protocol transitions
class AdvanceIn(BaseModel):
    action: str = Field(pattern="^(analyze|explore_options|close_understood|abandon|retry)$")


@router.post("/chambers/{cid}/advance")
def advance(cid: str, body: AdvanceIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    _require_active(ch)
    if body.action in ("analyze", "explore_options", "retry"):
        ratelimit.check(user.id, "engine")
    mems = protocol.members(db, ch)
    if body.action == "analyze":
        if ch.state != "INTAKE":
            err(409, "WRONG_STATE", "Analysis has already started.")
        if len(mems) < 2:
            err(409, "GATE_NOT_SATISFIED", "Invite at least one other person first.")
        endorsed = {i.user_id for i in db.scalars(select(Intake).where(Intake.chamber_id == ch.id, Intake.status == "ENDORSED"))}
        missing = [m.user.name for m in mems if m.user_id not in endorsed]
        if missing:
            err(409, "GATE_NOT_SATISFIED", "Still waiting for: " + ", ".join(missing))
        ch.state = "ANALYZING"
        protocol.emit(db, ch.id, "state.changed", "human", user.id, state="ANALYZING")
        db.commit()
        protocol.start_run(db, ch, "decompose")
    elif body.action == "explore_options":
        if ch.state != "MAP":
            err(409, "GATE_NOT_SATISFIED", "Options unlock after everyone has accepted how their view was explained.")
        ch.state = "OPTIONS_PENDING"
        protocol.emit(db, ch.id, "state.changed", "human", user.id, state="OPTIONS_PENDING")
        db.commit()
        protocol.start_run(db, ch, "options")
    elif body.action == "close_understood":
        if ch.state not in ("MAP", "RESOLUTION"):
            err(409, "WRONG_STATE", "You can close as 'understood' once the Map exists.")
        _close(db, ch, "UNDERSTOOD", user)
    elif body.action == "abandon":
        _close(db, ch, "ABANDONED", user)
    elif body.action == "retry":
        run = db.scalars(select(EngineRun).where(EngineRun.chamber_id == ch.id).order_by(EngineRun.created_at.desc())).first()
        if not run or run.status not in ("FAILED", "CANCELLED"):
            err(409, "NOTHING_TO_RETRY", "Nothing to retry.")
        protocol.start_run(db, ch, run.kind, target_id=run.target_id)
    db.refresh(ch)
    return chamber_view(ch, user, db)


def _close(db: Session, ch: Chamber, closed_state: str, user: User | None):
    ch.state = "CLOSED"
    ch.closed_state = closed_state
    ch.closed_at = now()
    ch.retain_until = retention.default_retain_until()
    protocol.emit(db, ch.id, "chamber.closed", "human" if user else "system", user.id if user else None, closed_state=closed_state)
    db.commit()
    if closed_state != "ABANDONED":
        protocol.start_run(db, ch, "learn")


class PredictionIn(BaseModel):
    text: str = Field(min_length=5, max_length=600)
    confidence: int = Field(ge=0, le=100)


@router.post("/chambers/{cid}/prediction")
def record_prediction(cid: str, body: PredictionIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Decision Replay: seal what you expect to happen. Editable until the Chamber is revisited."""
    ch, _ = _chamber_for_member(cid, user, db)
    if ch.state != "CLOSED" or ch.closed_state == "ABANDONED" or ch.purged_at:
        err(409, "WRONG_STATE", "Predictions are made when a Chamber closes.")
    if _has_revisit(db, ch):
        err(409, "UNSEALED", "This Chamber has been revisited; predictions are now open for review.")
    p = db.scalar(select(Prediction).where(Prediction.chamber_id == ch.id, Prediction.user_id == user.id))
    if p:
        p.text, p.confidence = body.text.strip(), body.confidence
    else:
        db.add(Prediction(chamber_id=ch.id, user_id=user.id, text=body.text.strip(), confidence=body.confidence))
    protocol.emit(db, ch.id, "prediction.recorded", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


class ReviewIn(BaseModel):
    verdict: str = Field(pattern="^(right|partly|wrong)$")
    note: str | None = Field(default=None, max_length=600)


@router.post("/chambers/{cid}/prediction/review")
def review_prediction(cid: str, body: ReviewIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    if not _has_revisit(db, ch):
        err(409, "SEALED", "Predictions are reviewed when the Chamber is revisited.")
    p = db.scalar(select(Prediction).where(Prediction.chamber_id == ch.id, Prediction.user_id == user.id))
    if not p:
        err(404, "NOT_FOUND", "You didn't record a prediction for this Chamber.")
    p.verdict, p.review_note, p.reviewed_at = body.verdict, (body.note or "").strip() or None, now()
    protocol.emit(db, ch.id, "prediction.reviewed", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


@router.post("/chambers/{cid}/revisit")
def revisit(cid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Reopen a closed Chamber as a new one with the same people, linked to the old outcome."""
    ch, _ = _chamber_for_member(cid, user, db)
    if ch.state != "CLOSED":
        err(409, "WRONG_STATE", "Only closed Chambers can be revisited.")
    ratelimit.check(user.id, "create")
    title = ch.title if ch.title.lower().startswith("revisit") else f"Revisit: {ch.title}"
    new = Chamber(
        creator_id=user.id,
        template=ch.template,
        title=title[:120],
        question=ch.question,
        invite_token=secrets.token_urlsafe(12),
        parent_id=ch.id,
    )
    db.add(new)
    db.flush()
    for i, m in enumerate(protocol.members(db, ch)):
        db.add(Membership(chamber_id=new.id, user_id=m.user_id, role="creator" if m.user_id == user.id else "participant", alias=_alias(i)))
    protocol.emit(db, new.id, "chamber.created", "human", user.id, revisit_of=ch.id)
    protocol.emit(db, ch.id, "chamber.revisited", "human", user.id)
    db.commit()
    return chamber_view(new, user, db)


@router.post("/chambers/{cid}/retention/extend")
def extend_retention(cid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    if ch.state != "CLOSED" or ch.purged_at:
        err(409, "WRONG_STATE", "Only closed Chambers that still have their content can be extended.")
    ch.retain_until = retention.extended_until(ch.retain_until)
    protocol.emit(db, ch.id, "retention.extended", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


@router.post("/chambers/{cid}/pause")
def pause(cid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    ch.paused = True
    ch.paused_by = user.id
    protocol.emit(db, ch.id, "chamber.paused", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


@router.post("/chambers/{cid}/resume")
def resume(cid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    if not ch.paused:
        return chamber_view(ch, user, db)
    if ch.paused_by and ch.paused_by != user.id:
        err(403, "NOT_YOUR_PAUSE", "Only the person who paused can resume.")
    if ch.paused_by is None:
        # Quiet safety pause: only the flagged person may resume.
        flag = db.scalar(select(SafetyFlag).where(SafetyFlag.chamber_id == ch.id, SafetyFlag.dismissed.is_(False)))
        if flag and flag.user_id != user.id:
            err(403, "PAUSED", "This Chamber is paused.")
        if flag:
            flag.dismissed = True
    ch.paused = False
    ch.paused_by = None
    protocol.emit(db, ch.id, "chamber.resumed", "human", user.id)
    db.commit()
    protocol.resume_pending_run(db, ch)
    return chamber_view(ch, user, db)


# ----------------------------------------------------------------------------- restatement gate
def _own_restatement(rid: str, user: User, db: Session) -> tuple[Restatement, Chamber]:
    r = db.get(Restatement, rid)
    if not r:
        err(404, "NOT_FOUND", "Restatement not found.")
    ch, _ = _chamber_for_member(r.chamber_id, user, db)
    if r.of_user_id != user.id:
        err(403, "NOT_YOURS", "Only the person whose view this describes can accept or correct it.")
    _require_active(ch)
    if ch.state != "RESTATEMENT":
        err(409, "WRONG_STATE", "The restatement stage is over.")
    return r, ch


def _maybe_gate_passed(db: Session, ch: Chamber):
    rs = list(db.scalars(select(Restatement).where(Restatement.chamber_id == ch.id)))
    if rs and all(r.status == "ACCEPTED" for r in rs):
        ch.state = "MAPPING"
        protocol.emit(db, ch.id, "gate.passed", "system")
        protocol.emit(db, ch.id, "state.changed", "system", state="MAPPING")
        db.commit()
        protocol.start_run(db, ch, "map")


@router.post("/restatements/{rid}/accept")
def accept_restatement(rid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    r, ch = _own_restatement(rid, user, db)
    if r.status == "REVISING":
        err(409, "REVISING", "A revision is in progress.")
    r.status = "ACCEPTED"
    protocol.emit(db, ch.id, "restatement.accepted", "human", user.id)
    db.commit()
    _maybe_gate_passed(db, ch)
    db.refresh(ch)
    return chamber_view(ch, user, db)


class RejectIn(BaseModel):
    feedback: str = Field(min_length=3, max_length=1000)


@router.post("/restatements/{rid}/reject")
def reject_restatement(rid: str, body: RejectIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    r, ch = _own_restatement(rid, user, db)
    ratelimit.check(user.id, "engine")
    if r.revision >= protocol.MAX_ENGINE_REVISIONS:
        err(409, "WRITE_YOUR_OWN", "After three tries, please write how you'd like your view explained.")
    r.status = "REVISING"
    r.feedback = body.feedback.strip()
    protocol.emit(db, ch.id, "restatement.rejected", "human", user.id)
    db.commit()
    protocol.start_run(db, ch, "revise", target_id=r.id)
    db.refresh(ch)
    return chamber_view(ch, user, db)


class WriteOwnIn(BaseModel):
    text: str = Field(min_length=3, max_length=1500)


@router.post("/restatements/{rid}/write")
def write_own_restatement(rid: str, body: WriteOwnIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    r, ch = _own_restatement(rid, user, db)
    if r.revision < protocol.MAX_ENGINE_REVISIONS:
        err(409, "NOT_YET", "Give the Mediator a chance to revise first.")
    r.text = body.text.strip()
    r.written_by = "human"
    r.status = "ACCEPTED"
    protocol.emit(db, ch.id, "restatement.accepted", "human", user.id, written_by="human")
    db.commit()
    _maybe_gate_passed(db, ch)
    db.refresh(ch)
    return chamber_view(ch, user, db)


class CruxIn(BaseModel):
    confirmed: bool


@router.post("/cruxes/{xid}/confirm")
def confirm_crux(xid: str, body: CruxIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    c = db.get(Crux, xid)
    if not c:
        err(404, "NOT_FOUND", "Crux not found.")
    ch, _ = _chamber_for_member(c.chamber_id, user, db)
    if c.party_id != user.id:
        err(403, "NOT_YOURS", "Only the person this crux belongs to can confirm it.")
    c.confirmed = body.confirmed
    protocol.emit(db, ch.id, "crux.confirmed" if body.confirmed else "crux.rejected", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


# ----------------------------------------------------------------------------- agreements
class RankingIn(BaseModel):
    order: list[int]


@router.post("/chambers/{cid}/ranking")
def submit_ranking(cid: str, body: RankingIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Rank the Mediator's options privately. Locked once everyone has ranked (no strategic re-ranking)."""
    ch, _ = _chamber_for_member(cid, user, db)
    _require_active(ch)
    if ch.state != "RESOLUTION" or not ch.options:
        err(409, "WRONG_STATE", "There are no options to rank yet.")
    if sorted(body.order) != list(range(len(ch.options))):
        err(400, "BAD_RANKING", "Rank every option exactly once.")
    mems = protocol.members(db, ch)
    if ranking_view(db, ch, user, mems)["complete"]:
        err(409, "RANKING_CLOSED", "Everyone has ranked; the results are in.")
    r = db.scalar(select(OptionRanking).where(OptionRanking.chamber_id == ch.id, OptionRanking.user_id == user.id))
    if r:
        r.order = body.order
    else:
        db.add(OptionRanking(chamber_id=ch.id, user_id=user.id, order=body.order))
    protocol.emit(db, ch.id, "ranking.submitted", "human", user.id)
    db.commit()
    if ranking_view(db, ch, user, mems)["complete"]:
        protocol.emit(db, ch.id, "ranking.revealed", "system")
        db.commit()
    return chamber_view(ch, user, db)


class ItemIn(BaseModel):
    text: str = Field(min_length=3, max_length=1000)
    from_option: bool = False
    kind: str = Field(default="agreement", pattern="^(agreement|understanding)$")


def _require_open_for(ch: Chamber, kind: str):
    """Agreements are made in RESOLUTION; an agree-to-disagree record after closing as UNDERSTOOD."""
    if ch.paused:
        err(409, "PAUSED", "This Chamber is paused. Resume it to continue.")
    if kind == "agreement":
        _require_active(ch)
        if ch.state != "RESOLUTION":
            err(409, "GATE_NOT_SATISFIED", "Agreements open after the Understanding Map and options.")
    elif not (ch.state == "CLOSED" and ch.closed_state == "UNDERSTOOD" and not ch.purged_at):
        err(409, "WRONG_STATE", "An agree-to-disagree record is for Chambers closed as understood.")


@router.post("/chambers/{cid}/agreement/items")
def add_item(cid: str, body: ItemIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    _require_open_for(ch, body.kind)
    if body.from_option and not ranking_view(db, ch, user, protocol.members(db, ch))["complete"]:
        err(409, "RANK_FIRST", "Everyone ranks the options privately before one is proposed.")
    # Adopting a Mediator option is still labelled as engine-proposed.
    item = AgreementItem(
        chamber_id=ch.id,
        text=body.text.strip(),
        proposed_by_type="engine" if body.from_option else "human",
        proposed_by_id=user.id,
        kind=body.kind,
    )
    db.add(item)
    protocol.emit(db, ch.id, "agreement.item.proposed", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


class DecideIn(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")


@router.post("/agreement-items/{iid}/decide")
def decide_item(iid: str, body: DecideIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Invariant 1: only an interactive human session can approve. Nothing is ever pre-approved."""
    item = db.get(AgreementItem, iid)
    if not item:
        err(404, "NOT_FOUND", "Item not found.")
    ch, _ = _chamber_for_member(item.chamber_id, user, db)
    _require_open_for(ch, item.kind or "agreement")
    a = db.scalar(select(Approval).where(Approval.item_id == iid, Approval.user_id == user.id))
    if a:
        a.decision = body.decision
        a.decided_at = now()
    else:
        db.add(Approval(item_id=iid, user_id=user.id, decision=body.decision))
    protocol.emit(db, ch.id, f"agreement.item.{body.decision}d", "human", user.id)
    db.commit()
    view = chamber_view(ch, user, db)
    if ch.state == "RESOLUTION" and view["agreement"]["all_approved"]:
        _close(db, ch, "AGREED", user)
        view = chamber_view(ch, user, db)
    return view


# ----------------------------------------------------------------------------- publishing
class ConsentIn(BaseModel):
    consent: bool
    show_name: bool = False


@router.post("/chambers/{cid}/publish/consent")
def publish_consent(cid: str, body: ConsentIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Publishing needs every participant's consent (AC10). Anonymized unless all opt into names (D17)."""
    ch, _ = _chamber_for_member(cid, user, db)
    latest_map = db.scalars(select(UnderstandingMap).where(UnderstandingMap.chamber_id == ch.id).order_by(UnderstandingMap.version.desc())).first()
    if not latest_map:
        err(409, "NO_MAP", "There's no Understanding Map to publish yet.")
    pub = db.scalar(select(Publication).where(Publication.chamber_id == ch.id))
    if not pub:
        pub = Publication(chamber_id=ch.id, slug=secrets.token_urlsafe(8).replace("_", "").replace("-", "").lower()[:10])
        db.add(pub)
        db.flush()
    c = db.scalar(select(PublicationConsent).where(PublicationConsent.publication_id == pub.id, PublicationConsent.user_id == user.id))
    if c:
        c.consent, c.show_name = body.consent, body.show_name
    else:
        db.add(PublicationConsent(publication_id=pub.id, user_id=user.id, consent=body.consent, show_name=body.show_name))
    db.flush()
    mems = protocol.members(db, ch)
    consents = {x.user_id: x for x in db.scalars(select(PublicationConsent).where(PublicationConsent.publication_id == pub.id))}
    if not body.consent:
        pub.status = "REVOKED" if pub.status == "PUBLISHED" else "PENDING"
        pub.snapshot = None
        protocol.emit(db, ch.id, "publication.consent.revoked", "human", user.id)
    elif all(m.user_id in consents and consents[m.user_id].consent for m in mems):
        show_names = all(consents[m.user_id].show_name for m in mems)
        label = {m.user_id: (m.user.name if show_names else m.alias) for m in mems}
        content = latest_map.content
        real_names = [m.user.name for m in mems]

        def anon(text: str) -> str:
            if show_names:
                return text
            for m in mems:
                text = text.replace(m.user.name, m.alias)
            return text

        pub.snapshot = {
            "title": anon(ch.title),
            "question": anon(ch.question),
            "template": ch.template,
            "headline": anon(content["headline"]),
            "summary": anon(content["summary"]),
            "where_you_stand": [{"label": label[w["party_id"]], "text": anon(w["text"])} for w in content["where_you_stand"]],
            "shared": [anon(s) for s in content["shared"]],
            "differences": [{**d, "summary": anon(d["summary"])} for d in content["differences"]],
            "cruxes": [{"label": label.get(c["party_id"], "Participant"), "text": anon(c["text"])} for c in content["cruxes"]],
            "open_questions": [anon(q) for q in content["open_questions"]],
            "closed_state": ch.closed_state,
            "participants": len(mems),
            "anonymized": not show_names,
        }
        assert show_names or not any(n in str(pub.snapshot) for n in real_names if len(n) > 2)
        pub.status = "PUBLISHED"
        pub.published_at = now()
        protocol.emit(db, ch.id, "publication.published", "system")
    else:
        protocol.emit(db, ch.id, "publication.consent.granted", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)
