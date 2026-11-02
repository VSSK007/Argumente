"""ORM models. Mirrors docs/SYSTEM_ARCHITECTURE.md §4 (simplified for the local MVP)."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, new_id, now


def _id(prefix):
    return lambda: new_id(prefix)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("usr"))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    is_adult: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    delegate: Mapped[Optional["Delegate"]] = relationship(
        back_populates="owner", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )


class AuthSession(Base):
    __tablename__ = "sessions"
    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # "human" = interactive browser session. "service" = automation (never allowed to endorse/approve/consent).
    actor_type: Mapped[str] = mapped_column(String, default="human")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Delegate(Base):
    __tablename__ = "delegates"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("dlg"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    handle: Mapped[str] = mapped_column(String, unique=True, index=True)  # always ends with ".d"
    name: Mapped[str] = mapped_column(String)
    glyph_seed: Mapped[str] = mapped_column(String)
    voice: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    methodology: Mapped[str] = mapped_column(String, default="pragmatist")
    autonomy: Mapped[str] = mapped_column(String, default="L1")  # L0 silent | L1 draft-and-approve
    status: Mapped[str] = mapped_column(String, default="ACTIVE")  # ACTIVE | PAUSED
    # Owner opt-in: others may rehearse a conversation against this Delegate (PUBLIC positions only).
    allow_rehearsal: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, default=False)
    # Owner opt-in: show the Position Record (public mind changes, steelmen accepted, calibration) on the profile.
    show_record: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    owner: Mapped[User] = relationship(back_populates="delegate")


class Position(Base):
    __tablename__ = "positions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("pos"))
    delegate_id: Mapped[str] = mapped_column(ForeignKey("delegates.id", ondelete="CASCADE"), index=True)
    statement: Mapped[str] = mapped_column(Text)
    topic: Mapped[str] = mapped_column(String, default="general")
    stance: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # agree | disagree | depends
    # ENDORSED | INFERRED | RETRACTED | CANDIDATE (suggested after a Chamber; never used until the owner keeps it)
    status: Mapped[str] = mapped_column(String, default="ENDORSED")
    scope_type: Mapped[str] = mapped_column(String, default="PRIVATE")  # PUBLIC | PRIVATE | CHAMBER
    scope_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_boundary: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String, default="ONBOARDING")
    history: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Chamber(Base):
    __tablename__ = "chambers"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("chm"))
    creator_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    template: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    question: Mapped[str] = mapped_column(Text)
    # INTAKE -> ANALYZING -> RESTATEMENT -> MAPPING -> MAP -> OPTIONS_PENDING -> RESOLUTION -> CLOSED
    state: Mapped[str] = mapped_column(String, default="INTAKE")
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    paused_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # user id, or None for a quiet safety pause
    closed_state: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # AGREED | UNDERSTOOD | ABANDONED
    invite_token: Mapped[str] = mapped_column(String, unique=True)
    options: Mapped[list] = mapped_column(JSON, default=list)
    engine_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Retention (D21): private content is deleted after retain_until (default: 90 days after close).
    retain_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    purged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    parent_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # set when this Chamber revisits another
    memberships: Mapped[list["Membership"]] = relationship(cascade="all, delete-orphan", order_by="Membership.joined_at")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("chamber_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String, default="participant")  # creator | participant
    alias: Mapped[str] = mapped_column(String)  # "Participant A" — used for anonymized publishing
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    user: Mapped[User] = relationship()


class Intake(Base):
    """A participant's private position inside one Chamber."""

    __tablename__ = "intakes"
    __table_args__ = (UniqueConstraint("chamber_id", "user_id"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("itk"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="DRAFT")  # DRAFT | ENDORSED
    authored_by: Mapped[str] = mapped_column(String, default="human")  # human | delegate
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Node(Base):
    __tablename__ = "nodes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("nod"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String)  # CLAIM | ASSUMPTION | INTEREST | VALUE | DISAGREEMENT
    claim_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    text: Mapped[str] = mapped_column(Text)
    holder_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    author_type: Mapped[str] = mapped_column(String, default="engine")
    epistemic_status: Mapped[str] = mapped_column(String)  # ENDORSED | PROPOSED | INFERRED
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    basis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    party_ids: Mapped[list] = mapped_column(JSON, default=list)
    source_intake_ids: Mapped[list] = mapped_column(JSON, default=list)


class Restatement(Base):
    __tablename__ = "restatements"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("rst"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    of_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="PENDING")  # PENDING | REVISING | ACCEPTED | REJECTED
    revision: Mapped[int] = mapped_column(Integer, default=1)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    written_by: Mapped[str] = mapped_column(String, default="engine")  # engine | human
    source_node_ids: Mapped[list] = mapped_column(JSON, default=list)


class Crux(Base):
    __tablename__ = "cruxes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("crx"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    party_id: Mapped[str] = mapped_column(String)
    text: Mapped[str] = mapped_column(Text)
    question: Mapped[str] = mapped_column(Text)
    confirmed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)


class UnderstandingMap(Base):
    __tablename__ = "understanding_maps"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("map"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AgreementItem(Base):
    __tablename__ = "agreement_items"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("agi"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    proposed_by_type: Mapped[str] = mapped_column(String)  # human | engine
    proposed_by_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # "agreement" (RESOLUTION) or "understanding" (an agree-to-disagree record after closing as understood)
    kind: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="agreement")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Approval(Base):
    __tablename__ = "approvals"
    __table_args__ = (UniqueConstraint("item_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("agreement_items.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    decision: Mapped[str] = mapped_column(String)  # approve | reject
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Publication(Base):
    __tablename__ = "publications"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("pub"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), unique=True)
    slug: Mapped[str] = mapped_column(String, unique=True)
    status: Mapped[str] = mapped_column(String, default="PENDING")  # PENDING | PUBLISHED | REVOKED
    snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class PublicationConsent(Base):
    __tablename__ = "publication_consents"
    __table_args__ = (UniqueConstraint("publication_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    publication_id: Mapped[str] = mapped_column(ForeignKey("publications.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    consent: Mapped[bool] = mapped_column(Boolean)
    show_name: Mapped[bool] = mapped_column(Boolean, default=False)


class ChamberEvent(Base):
    __tablename__ = "chamber_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String)
    actor_type: Mapped[str] = mapped_column(String)  # human | delegate | engine | system
    actor_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class EngineRun(Base):
    __tablename__ = "engine_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("run"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String)  # decompose | revise | map | options
    status: Mapped[str] = mapped_column(String, default="RUNNING")  # RUNNING | DONE | FAILED | CANCELLED
    step: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    engine_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class SparSession(Base):
    __tablename__ = "spar_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("spr"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    claim: Mapped[str] = mapped_column(Text)
    mode: Mapped[str] = mapped_column(String)  # devils_advocate | steelman | rehearsal
    methodology: Mapped[str] = mapped_column(String)
    target_delegate_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # rehearsal only
    turns: Mapped[list] = mapped_column(JSON, default=list)
    report: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")  # ACTIVE | FINISHED
    engine_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SafetyFlag(Base):
    __tablename__ = "safety_flags"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("sfl"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    chamber_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("rpt"))
    reporter_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    target_type: Mapped[str] = mapped_column(String)
    target_id: Mapped[str] = mapped_column(String)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class PreRoundTurn(Base):
    """A Delegate's turn in the optional pre-round (ARGUMENTATIVE_INTELLIGENCE.md §3.2).

    Drafted by the Delegate, visible only to its owner until the owner releases it. Released turns of
    a phase become visible to everyone only once every participant has released or withdrawn theirs.
    """

    __tablename__ = "preround_turns"
    __table_args__ = (UniqueConstraint("chamber_id", "owner_id", "kind"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("prt"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String)  # opening | reply
    text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="DRAFT")  # DRAFT | RELEASED | WITHDRAWN
    authored_by: Mapped[str] = mapped_column(String, default="delegate")  # delegate | human
    unknowns: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class OptionRanking(Base):
    """A participant's private ranking of the Mediator's options (Resolution Architect).
    Individual rankings are never shown to others; only the aggregate, once everyone has ranked."""

    __tablename__ = "option_rankings"
    __table_args__ = (UniqueConstraint("chamber_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    order: Mapped[list] = mapped_column(JSON)  # option indices, most preferred first
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Prediction(Base):
    """Decision Replay: a sealed prediction made when a Chamber closes, revealed when it's revisited."""

    __tablename__ = "predictions"
    __table_args__ = (UniqueConstraint("chamber_id", "user_id"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("prd"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    confidence: Mapped[int] = mapped_column(Integer)  # 0-100
    verdict: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # right | partly | wrong
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class Steelman(Base):
    """Steelman Exchange: one person writes another's view in their own words; that person rates it.
    Visible only to the two of them unless the subject rates it 4 or 5 ("accepted")."""

    __tablename__ = "steelmen"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("stm"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5, by the subject only
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    rated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class QuizItem(Base):
    """Understanding Score item: a statement taken verbatim from someone's endorsed claims."""

    __tablename__ = "quiz_items"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("qzi"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    node_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)


class QuizAnswer(Base):
    """phase: self (your own view: the ground truth), pre (guessing others before reading the
    restatements), post (guessing again after the Map)."""

    __tablename__ = "quiz_answers"
    __table_args__ = (UniqueConstraint("item_id", "respondent_id", "about_id", "phase"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("quiz_items.id", ondelete="CASCADE"))
    respondent_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    about_id: Mapped[str] = mapped_column(String)
    phase: Mapped[str] = mapped_column(String)  # self | pre | post
    answer: Mapped[str] = mapped_column(String)  # agree | disagree | unsure


class Evidence(Base):
    """Evidence board: sources and notes people add side by side for a factual difference or a crux."""

    __tablename__ = "evidence"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("evd"))
    chamber_id: Mapped[str] = mapped_column(ForeignKey("chambers.id", ondelete="CASCADE"), index=True)
    target_id: Mapped[str] = mapped_column(String)  # a DISAGREEMENT node id or a crux id
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stance: Mapped[str] = mapped_column(String)  # supports | challenges | context
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class MindChange(Base):
    """Position Record: 'I changed my mind about…'. Private unless the owner marks it public."""

    __tablename__ = "mind_changes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("mch"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chamber_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    text: Mapped[str] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ServerKey(Base):
    """Signing key for Delegate Mandates (Ed25519). Generated on first use."""

    __tablename__ = "server_keys"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # key id
    private_pem: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Topic(Base):
    """Public topic (Polis-style): people add short statements and vote; the app maps opinion groups."""

    __tablename__ = "topics"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("tpc"))
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    question: Mapped[str] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creator_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String, default="OPEN")  # OPEN | CLOSED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TopicStatement(Base):
    __tablename__ = "topic_statements"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id("tst"))
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))  # never shown publicly
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")  # ACTIVE | HIDDEN
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TopicVote(Base):
    __tablename__ = "topic_votes"
    __table_args__ = (UniqueConstraint("statement_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    statement_id: Mapped[str] = mapped_column(ForeignKey("topic_statements.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    vote: Mapped[int] = mapped_column(Integer)  # 1 agree, -1 disagree, 0 pass
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
