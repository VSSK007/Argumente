"""Public topics: statements, anonymous votes and the opinion landscape. Only people vote; Delegates never do."""

import re
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import ratelimit, safety
from ..auth import human_user
from ..db import get_db
from ..models import AuthSession, Topic, TopicStatement, TopicVote, User
from ..topics import analyze

router = APIRouter(tags=["topics"])
MAX_STATEMENTS_PER_PERSON = 10


def err(status, code, message):
    raise HTTPException(status, {"code": code, "message": message})


def _optional_user(authorization: str | None, db: Session) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    sess = db.get(AuthSession, authorization.split(" ", 1)[1].strip())
    return db.get(User, sess.user_id) if sess else None


def _slug(question: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", question.lower()).strip("-")[:48].strip("-") or "topic"
    return f"{base}-{secrets.token_hex(2)}"


def _topic(db: Session, slug: str) -> Topic:
    t = db.scalar(select(Topic).where(Topic.slug == slug))
    if not t:
        err(404, "NOT_FOUND", "No such topic.")
    return t


def _screen(text: str):
    # Public, anonymous text: refuse anything the safety screen flags instead of publishing it.
    if safety.screen(text):
        err(400, "NOT_PUBLISHABLE", "This can't be posted publicly. If you or someone else is at risk, please contact local emergency services or a helpline.")


@router.get("/topics")
def list_topics(db: Session = Depends(get_db)):
    out = []
    for t in db.scalars(select(Topic).order_by(Topic.created_at.desc())):
        n_st = len(list(db.scalars(select(TopicStatement.id).where(TopicStatement.topic_id == t.id, TopicStatement.status == "ACTIVE"))))
        voters = {u for (u,) in db.execute(select(TopicVote.user_id).where(TopicVote.topic_id == t.id))}
        out.append({"slug": t.slug, "question": t.question, "status": t.status, "statements": n_st, "participants": len(voters), "created_at": t.created_at.isoformat()})
    return out


class TopicIn(BaseModel):
    question: str = Field(min_length=8, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    seed_statements: list[str] = Field(default_factory=list, max_length=10)


@router.post("/topics")
def create_topic(body: TopicIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ratelimit.check(user.id, "create")
    _screen(body.question + " " + (body.description or ""))
    t = Topic(slug=_slug(body.question), question=body.question.strip(), description=(body.description or "").strip() or None, creator_id=user.id)
    db.add(t)
    db.flush()
    for s in body.seed_statements:
        s = s.strip()
        if 5 <= len(s) <= 280:
            _screen(s)
            db.add(TopicStatement(topic_id=t.id, author_id=user.id, text=s))
    db.commit()
    return {"slug": t.slug}


@router.get("/topics/{slug}")
def get_topic(slug: str, authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    """Public. Statement authors and individual votes are never returned; signed-in callers also get
    their own votes and their own opinion group."""
    t = _topic(db, slug)
    me = _optional_user(authorization, db)
    statements = list(db.scalars(select(TopicStatement).where(TopicStatement.topic_id == t.id, TopicStatement.status == "ACTIVE").order_by(TopicStatement.created_at)))
    ids = [s.id for s in statements]
    votes = [(v.user_id, v.statement_id, v.vote) for v in db.scalars(select(TopicVote).where(TopicVote.topic_id == t.id)) if v.statement_id in ids]
    a = analyze(ids, votes, me.id if me else None)
    mine = {s: v for u, s, v in votes if me and u == me.id}
    text = {s.id: s.text for s in statements}

    def with_text(rows):
        return [{**r, "text": text[r["statement_id"]]} for r in rows]

    return {
        "slug": t.slug,
        "question": t.question,
        "description": t.description,
        "status": t.status,
        "is_creator": bool(me and me.id == t.creator_id),
        "statements": [{"id": s.id, "text": s.text, "is_mine": bool(me and s.author_id == me.id), **a["stats"][s.id]} for s in statements],
        "participants": a["participants"],
        "mapped": a["mapped"],
        "points": a["points"],
        "groups": [{**g, "distinctive": with_text(g["distinctive"])} for g in a["groups"]],
        "consensus": with_text(a["consensus"]),
        "divisive": with_text(a["divisive"]),
        "my_votes": mine,
        "my_group": a["my_group"],
        "min_group": 3,
    }


class StatementIn(BaseModel):
    text: str = Field(min_length=5, max_length=280)


@router.post("/topics/{slug}/statements")
def add_statement(slug: str, body: StatementIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    t = _topic(db, slug)
    if t.status != "OPEN":
        err(409, "CLOSED", "This topic is closed.")
    ratelimit.check(user.id, "create")
    mine = list(db.scalars(select(TopicStatement.id).where(TopicStatement.topic_id == t.id, TopicStatement.author_id == user.id)))
    if len(mine) >= MAX_STATEMENTS_PER_PERSON:
        err(409, "TOO_MANY", f"You've added {MAX_STATEMENTS_PER_PERSON} statements here. Vote on others'.")
    text = body.text.strip()
    _screen(text)
    if db.scalar(select(TopicStatement.id).where(TopicStatement.topic_id == t.id, TopicStatement.text == text)):
        err(409, "DUPLICATE", "That statement is already here. Vote on it instead.")
    db.add(TopicStatement(topic_id=t.id, author_id=user.id, text=text))
    db.commit()
    return {"ok": True}


class VoteIn(BaseModel):
    vote: int = Field(ge=-1, le=1)


@router.post("/topic-statements/{sid}/vote")
def vote(sid: str, body: VoteIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Votes come only from interactive human sessions. Delegates never vote: no manufactured consensus."""
    s = db.get(TopicStatement, sid)
    if not s or s.status != "ACTIVE":
        err(404, "NOT_FOUND", "No such statement.")
    t = db.get(Topic, s.topic_id)
    if t.status != "OPEN":
        err(409, "CLOSED", "This topic is closed.")
    v = db.scalar(select(TopicVote).where(TopicVote.statement_id == sid, TopicVote.user_id == user.id))
    if v:
        v.vote = body.vote
    else:
        db.add(TopicVote(topic_id=t.id, statement_id=sid, user_id=user.id, vote=body.vote))
    db.commit()
    return {"ok": True}


@router.post("/topic-statements/{sid}/hide")
def hide_statement(sid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    s = db.get(TopicStatement, sid)
    if not s:
        err(404, "NOT_FOUND", "No such statement.")
    t = db.get(Topic, s.topic_id)
    if user.id != t.creator_id:
        err(403, "NOT_CREATOR", "Only the person who started the topic can hide statements. Use Report instead.")
    s.status = "HIDDEN"
    db.commit()
    return {"ok": True}


@router.post("/topics/{slug}/close")
def close_topic(slug: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    t = _topic(db, slug)
    if user.id != t.creator_id:
        err(403, "NOT_CREATOR", "Only the person who started the topic can close it.")
    t.status = "CLOSED"
    db.commit()
    return {"ok": True}
