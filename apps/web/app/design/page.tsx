"use client";

import { ArgumentGraph } from "@/components/chamber/ArgumentGraph";
import { MapView } from "@/components/MapView";
import {
  Button,
  Card,
  DelegateBadge,
  EngineThinking,
  EpistemicTag,
  Glyph,
  HumanAvatar,
  MediatorBadge,
  SectionTitle,
  StateRail,
  TypeChip,
} from "@/components/ui";

/** Design-system gallery with fixed sample data. Also the reference page for visual regression tests. */

const MAP = {
  headline: "How should we split the chores in the flat?",
  summary: "3 people weighed in. The differences look mostly like value and prediction disagreements, with some shared ground.",
  stands: [
    { label: "Dev", text: "Dev’s position, in their words: “Chores should be split by time, because cleaning the bathroom takes far longer than taking out the bins.”" },
    { label: "Maya", text: "Maya’s position, in their words: “We should just alternate weeks.” They add: “A time log will create more arguments, not fewer.”", written_by: "human" },
  ],
  shared: ["Everyone raised fairness."],
  differences: [
    { type: "VALUE", summary: "Dev emphasizes effort and time; Maya emphasizes simplicity.", why_type_matters: "This is a difference in priorities. More facts alone won’t resolve it." },
    { type: "PREDICTION", summary: "Maya expects a time log to cause more arguments.", why_type_matters: "You expect different outcomes. Try it for a while and review." },
  ],
  cruxes: [{ label: "Dev", text: "Cleaning the bathroom takes far longer than taking out the bins.", confirmed: true }],
  open_questions: ["Which of these priorities should win when they conflict?", "How would you find out who’s right?"],
};

const PEOPLE = [
  { user_id: "u1", name: "Dev" },
  { user_id: "u2", name: "Maya" },
];
const NODES = [
  { id: "v", kind: "VALUE", text: "Everyone raised fairness.", epistemic_status: "PROPOSED", party_ids: ["u1", "u2"] },
  { id: "d1", kind: "DISAGREEMENT", claim_type: "VALUE", text: "Dev emphasizes time spent; Maya emphasizes simplicity.", epistemic_status: "PROPOSED", party_ids: ["u1", "u2"] },
  { id: "d2", kind: "DISAGREEMENT", claim_type: "PREDICTION", text: "Maya expects a time log to cause more arguments.", epistemic_status: "PROPOSED", party_ids: ["u2"] },
  { id: "c1", kind: "CLAIM", claim_type: "VALUE", text: "Chores should be split by time.", holder_id: "u1", epistemic_status: "ENDORSED", party_ids: ["u1"] },
  { id: "c2", kind: "CLAIM", claim_type: "POLICY", text: "We should just alternate weeks.", holder_id: "u2", epistemic_status: "ENDORSED", party_ids: ["u2"] },
  { id: "c3", kind: "CLAIM", claim_type: "PREDICTION", text: "A time log will create more arguments, not fewer.", holder_id: "u2", epistemic_status: "ENDORSED", party_ids: ["u2"] },
  { id: "i1", kind: "INTEREST", text: "Appears to care about effort being recognised.", holder_id: "u1", epistemic_status: "INFERRED", party_ids: ["u1"] },
];
const CRUXES = [{ id: "x1", party_id: "u1", text: "The bathroom takes far longer than the bins.", confirmed: true }];

export default function DesignPage() {
  return (
    <div className="space-y-12" data-testid="design-gallery">
      <div>
        <div className="label-mono text-ink-2">Design system</div>
        <h1 className="font-display text-4xl">Argumenté components</h1>
        <p className="prose-body mt-2 text-ink-2">Paper and ink. Humans are circles, Delegates rounded squares, the Mediator a § in ochre.</p>
      </div>

      <section>
        <SectionTitle kicker="Identity grammar">Who is speaking</SectionTitle>
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <HumanAvatar name="Maya Okafor" /> <span>Maya (human)</span>
          </div>
          <DelegateBadge name="Juniper" ownerName="Maya" handle="maya.d" seed="design-seed-1" />
          <MediatorBadge />
          <div className="flex gap-2">
            {["a", "b", "c", "d", "e", "f"].map((s) => (
              <Glyph key={s} seed={`glyph-${s}`} size={36} />
            ))}
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle kicker="Labels">Epistemic status and disagreement types</SectionTitle>
        <Card className="flex flex-wrap gap-2">
          {["ENDORSED", "PROPOSED", "INFERRED", "DRAFT", "UNKNOWN"].map((s) => (
            <EpistemicTag key={s} status={s} />
          ))}
          {["FACT", "VALUE", "INTEREST", "INTERPRETATION", "PREDICTION", "DEFINITION"].map((t) => (
            <TypeChip key={t} type={t} />
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle kicker="Actions">Buttons</SectionTitle>
        <Card className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </Card>
      </section>

      <section>
        <SectionTitle kicker="Protocol">Progress and the Mediator at work</SectionTitle>
        <Card className="space-y-4">
          <StateRail state="INTAKE" />
          <StateRail state="RESTATEMENT" />
          <StateRail state="RESOLUTION" />
          <EngineThinking step="Typing the disagreements" />
        </Card>
      </section>

      <section>
        <SectionTitle kicker="Signature">Argument graph</SectionTitle>
        <ArgumentGraph nodes={NODES} people={PEOPLE} cruxes={CRUXES} />
      </section>

      <section>
        <SectionTitle kicker="Signature">Understanding Map</SectionTitle>
        <MapView map={MAP} />
      </section>
    </div>
  );
}
