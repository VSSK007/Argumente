"""Typed inputs/outputs for the Argumentative Intelligence engine.

The same models are used as structured-output schemas for the LLM provider and as the
return type of the offline (local) provider, so the rest of the app never sees free text.
"""

from typing import Literal

from pydantic import BaseModel, Field

ClaimType = Literal["FACT", "VALUE", "POLICY", "PREDICTION", "INTERPRETATION", "DEFINITION"]
DisagreementType = Literal["FACT", "VALUE", "INTEREST", "INTERPRETATION", "PREDICTION", "DEFINITION"]


class Party(BaseModel):
    party_id: str
    label: str  # display name used inside prompts, e.g. "Priya"
    text: str  # the party's ENDORSED position text, verbatim


# ---------- decompose ----------
class ExtractedClaim(BaseModel):
    party_id: str
    text: str = Field(description="Quote the party's own words where possible; paraphrase only if necessary.")
    claim_type: ClaimType


class PartyNote(BaseModel):
    party_id: str
    text: str


class Disagreement(BaseModel):
    type: DisagreementType
    summary: str = Field(description="One neutral sentence naming what differs, mentioning each side fairly.")
    party_ids: list[str]


class CruxCandidate(BaseModel):
    party_id: str
    text: str = Field(description="The belief that, if it changed, would likely change this party's position.")
    question: str = Field(description="A gentle yes/no question to ask that party to confirm the crux.")


class Decomposition(BaseModel):
    claims: list[ExtractedClaim]
    assumptions: list[PartyNote] = Field(description="Implicit premises each party's argument relies on.")
    interests: list[PartyNote] = Field(description="Underlying needs or stakes, not positions.")
    shared_values: list[str] = Field(description="Values or observations ALL parties appear to share.")
    disagreements: list[Disagreement]
    cruxes: list[CruxCandidate]


# ---------- restatement ----------
class RestatementOut(BaseModel):
    text: str = Field(
        description="2-4 sentences explaining this party's view to the group, in the third person, "
        "faithful to their words. No evaluation, no new claims."
    )


# ---------- map ----------
class MapDifference(BaseModel):
    type: DisagreementType
    summary: str
    why_type_matters: str


class MapOut(BaseModel):
    headline: str = Field(description="The question being discussed, as a short neutral headline.")
    summary: str = Field(description="Two neutral sentences describing the shape of the disagreement.")
    shared: list[str]
    differences: list[MapDifference]
    open_questions: list[str] = Field(description="3-5 discussion questions. Questions, never verdicts.")


# ---------- options ----------
class OptionOut(BaseModel):
    title: str
    description: str
    serves: list[str] = Field(description="Labels of the parties whose stated interests this option serves.")
    trade_offs: str


class OptionsOut(BaseModel):
    options: list[OptionOut]


# ---------- delegate draft ----------
class DraftOut(BaseModel):
    text: str = Field(description="A first-person draft the owner can edit. Only use the endorsed positions given.")
    used_position_ids: list[str]
    unknowns: list[str] = Field(description="Things the Delegate does not know about its owner's view here.")


# ---------- spar ----------
class SparTurnOut(BaseModel):
    challenge: str
    attack_type: Literal["rebut", "undercut", "undermine", "question", "steelman"]


class SparReport(BaseModel):
    verdict: Literal["robust", "revised", "open"]
    strongest_objection: str
    how_you_responded: str
    what_to_strengthen: list[str]
