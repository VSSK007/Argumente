"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useMe } from "@/lib/api";
import { Button, Card, ErrorNote, Glyph, Input, TextArea } from "@/components/ui";

type CardT = { id: string; topic: string; text: string };
type Answer = { card_id: string; statement: string; topic: string; stance: "agree" | "disagree" | "depends"; why?: string; scope_type: "PRIVATE" | "PUBLIC" };

const VOICE = [
  { key: "directness", left: "Diplomatic", right: "Direct" },
  { key: "thoroughness", left: "Brief", right: "Thorough" },
  { key: "warmth", left: "Dry", right: "Warm" },
];

function OnboardingInner() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const { me } = useMe();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [voice, setVoice] = useState<Record<string, number>>({ directness: 0.5, thoroughness: 0.5, warmth: 0.5 });
  const [methodology, setMethodology] = useState("pragmatist");
  const [cards, setCards] = useState<CardT[]>([]);
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [why, setWhy] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/position-cards").then((r) => {
      setCards(r.cards);
      setMethods(r.methodologies);
    });
  }, []);
  useEffect(() => {
    if (me && !name) setName(`${me.name}'s Delegate`);
    if (me?.has_delegate) router.replace(next);
  }, [me]); // eslint-disable-line

  const seed = `${me?.id ?? ""}${name}`;
  const card = cards[idx];

  function answer(stance: Answer["stance"] | null) {
    if (stance && card) {
      setAnswers((a) => [...a, { card_id: card.id, statement: card.text, topic: card.topic, stance, why: why.trim() || undefined, scope_type: "PRIVATE" }]);
    }
    setWhy("");
    if (idx + 1 >= cards.length) setStep(3);
    else setIdx(idx + 1);
  }

  async function create() {
    setError(null);
    try {
      await api("/delegates", { body: { name, voice, methodology, answers } });
      window.dispatchEvent(new Event("argumente-auth"));
      router.push(next);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="label-mono text-ink-2">Step {Math.min(step + 1, 3)} of 3</div>
      {step === 0 && (
        <>
          <h1 className="mt-2 font-display text-4xl">Who represents you?</h1>
          <p className="prose-body mt-3 text-ink-2">
            Your Delegate is an AI that can draft your positions, but only from things you’ve <strong>endorsed</strong>. It never
            pretends to be you, and nothing it writes is shared until you approve it.
          </p>
          <Card className="mt-6 flex items-center gap-4">
            <Glyph seed={seed} size={56} />
            <label className="block flex-1 text-sm">
              Name your Delegate
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          </Card>
          <div className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                sessionStorage.setItem("skip-onboarding", "1");
                router.push(next);
              }}
            >
              Skip for now (join as a guest)
            </Button>
            <Button onClick={() => setStep(1)} disabled={!name.trim()}>
              Next
            </Button>
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <h1 className="mt-2 font-display text-4xl">How should it reason?</h1>
          <Card className="mt-6 space-y-5">
            {VOICE.map((v) => (
              <div key={v.key}>
                <div className="flex justify-between text-xs text-ink-2">
                  <span>{v.left}</span>
                  <span>{v.right}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={voice[v.key]}
                  onChange={(e) => setVoice({ ...voice, [v.key]: Number(e.target.value) })}
                  className="w-full accent-[#3B5BDB]"
                  aria-label={`${v.left} to ${v.right}`}
                />
              </div>
            ))}
          </Card>
          <div className="mt-6 grid gap-2">
            {Object.entries(methods).map(([k, desc]) => (
              <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${methodology === k ? "border-ink bg-white" : "hairline"}`}>
                <input type="radio" name="m" checked={methodology === k} onChange={() => setMethodology(k)} className="mt-1" />
                <span>
                  <span className="font-medium capitalize">{k}</span>
                  <span className="block text-sm text-ink-2">{desc}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        </>
      )}
      {step === 2 && card && (
        <>
          <h1 className="mt-2 font-display text-4xl">Teach it a few positions</h1>
          <p className="mt-2 text-sm text-ink-2">
            Card {idx + 1} of {cards.length} · {answers.length} endorsed so far · Skip any you don’t have a view on.
          </p>
          <Card className="mt-6">
            <div className="label-mono text-ink-2">{card.topic}</div>
            <p className="mt-2 font-display text-2xl leading-snug">{card.text}</p>
            <TextArea rows={2} className="mt-4 text-base" placeholder="Why? (optional, one line)" value={why} onChange={(e) => setWhy(e.target.value)} />
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => answer("disagree")}>
                Disagree
              </Button>
              <Button variant="secondary" onClick={() => answer("depends")}>
                Depends
              </Button>
              <Button variant="secondary" onClick={() => answer("agree")}>
                Agree
              </Button>
            </div>
            <div className="mt-3 text-center">
              <button className="text-sm text-ink-2 underline" onClick={() => answer(null)}>
                Skip this one
              </button>
            </div>
          </Card>
          {answers.length >= 6 ? (
            <div className="mt-4 text-right">
              <Button variant="ghost" onClick={() => setStep(3)}>
                That’s enough, finish →
              </Button>
            </div>
          ) : null}
        </>
      )}
      {step === 3 && (
        <>
          <h1 className="mt-2 font-display text-4xl">
            {name} knows {answers.length} thing{answers.length === 1 ? "" : "s"} about you.
          </h1>
          <p className="prose-body mt-2 text-ink-2">Nothing else. You can inspect, edit or retract any of it at any time in Me → Memory.</p>
          <Card className="mt-6 space-y-2">
            {answers.map((a, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border-b hairline pb-2 last:border-0">
                <div className="text-sm">
                  <span className="label-mono mr-2 text-ink-2">{a.stance}</span>
                  {a.statement}
                  {a.why ? <span className="text-ink-2">. Why: {a.why}</span> : null}
                </div>
                <label className="flex shrink-0 items-center gap-1 text-xs text-ink-2" title="Public positions appear on your Delegate's profile">
                  <input
                    type="checkbox"
                    checked={a.scope_type === "PUBLIC"}
                    onChange={(e) =>
                      setAnswers(answers.map((x, j) => (j === i ? { ...x, scope_type: e.target.checked ? "PUBLIC" : "PRIVATE" } : x)))
                    }
                  />
                  public
                </label>
              </div>
            ))}
            {!answers.length ? <p className="text-sm text-ink-2">No positions yet. Your Delegate will say “I don’t know” until you teach it.</p> : null}
          </Card>
          <ErrorNote error={error} />
          <div className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setIdx(0);
                setAnswers([]);
                setStep(2);
              }}
            >
              Start cards over
            </Button>
            <Button onClick={create}>Create my Delegate</Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Onboarding() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  );
}
