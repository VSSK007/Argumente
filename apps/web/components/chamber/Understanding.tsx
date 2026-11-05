"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorNote, HumanAvatar, SectionTitle, TextArea, TypeChip } from "@/components/ui";

type Act = (p: string, b?: unknown) => Promise<any>;
type Member = { user_id: string; name: string; is_me: boolean };

/* ======================================================================= Understanding Score */

const CHOICES: [string, string][] = [
  ["agree", "Agrees"],
  ["disagree", "Disagrees"],
  ["unsure", "Not sure"],
];

/** "Before you read how others' views were explained, guess." Then again after the Map. */
export function QuizPanel({ ch, act, phase, onSkip }: { ch: any; act: Act; phase: "pre" | "post"; onSkip?: () => void }) {
  const q = ch.quiz;
  const others: Member[] = ch.members.filter((m: Member) => !m.is_me);
  const needSelf = !q.self_done;
  const [self, setSelf] = useState<Record<string, string>>({});
  const [guess, setGuess] = useState<Record<string, Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const complete =
    (!needSelf || q.items.every((i: any) => self[i.id])) && others.every((o) => q.items.every((i: any) => guess[o.user_id]?.[i.id]));

  return (
    <Card className="border-delegate/50">
      <SectionTitle kicker={phase === "pre" ? "Understanding Score · 1 minute · before you read" : "Understanding Score · after the Map"}>
        {phase === "pre" ? "How well do you know where everyone stands?" : "Now guess again"}
      </SectionTitle>
      <p className="mb-4 text-sm text-ink-2">
        {phase === "pre"
          ? "Each statement below is something someone in this Chamber said. Say what you think, then guess what each other person thinks. After the Map you’ll guess again and see how much your understanding moved."
          : "Same statements, now that you’ve read the Map. Your guesses are scored against what each person said about themselves."}{" "}
        Your individual scores are private to you; others only see the group average.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="label-mono pb-2 font-normal text-ink-2">Statement</th>
              {needSelf ? <th className="label-mono pb-2 font-normal text-ink-2">You</th> : null}
              {others.map((o) => (
                <th key={o.user_id} className="label-mono pb-2 font-normal text-ink-2">
                  {o.name} (guess)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.items.map((it: any) => (
              <tr key={it.id} className="border-t hairline align-top">
                <td className="py-3 pr-3 font-body">“{it.text}”</td>
                {needSelf ? (
                  <td className="py-3 pr-2">
                    <Choice name={`self-${it.id}`} label={`Your view: ${it.text}`} value={self[it.id]} onChange={(v) => setSelf({ ...self, [it.id]: v })} />
                  </td>
                ) : null}
                {others.map((o) => (
                  <td key={o.user_id} className="py-3 pr-2">
                    <Choice
                      name={`${o.user_id}-${it.id}`}
                      label={`${o.name}'s view: ${it.text}`}
                      value={guess[o.user_id]?.[it.id]}
                      onChange={(v) => setGuess({ ...guess, [o.user_id]: { ...(guess[o.user_id] ?? {}), [it.id]: v } })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={!complete || ch.paused}
          onClick={async () => {
            setError(null);
            const r = await act(`/chambers/${ch.id}/quiz`, { phase, self_answers: needSelf ? self : {}, predictions: guess });
            if (!r) setError("Couldn’t save. Check every row is answered.");
          }}
        >
          Lock in my guesses
        </Button>
        {onSkip ? (
          <button className="text-sm text-ink-2 underline" onClick={onSkip}>
            Skip
          </button>
        ) : null}
        <span className="text-xs text-ink-2">Answers lock once submitted, so the score stays honest.</span>
      </div>
      <ErrorNote error={error} />
    </Card>
  );
}

function Choice({ name, label, value, onChange }: { name: string; label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-1" aria-label={label}>
      {CHOICES.map(([v, l]) => (
        <label key={v} className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${value === v ? "bg-ink text-paper" : "hover:bg-paper-2"}`}>
          <input type="radio" className="sr-only" name={name} checked={value === v} onChange={() => onChange(v)} />
          {l}
        </label>
      ))}
    </fieldset>
  );
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 100));

/** The before/after delta: the proof that the Chamber did its job. */
export function ScoreCard({ ch }: { ch: any }) {
  const q = ch.quiz;
  const rows = q.mine.filter((m: any) => m.pre !== null || m.post !== null);
  const waiting = q.mine.filter((m: any) => m.pre === null && m.post === null).map((m: any) => m.about_name);
  const g = q.group;
  if (!rows.length && g.pre === null && g.post === null && !(q.pre_done || q.post_done)) return null;
  return (
    <Card>
      <SectionTitle kicker="Understanding Score">How much better do you understand each other?</SectionTitle>
      <ul className="space-y-4">
        {rows.map((m: any) => (
          <li key={m.about_id}>
            <div className="flex items-center gap-2">
              <HumanAvatar name={m.about_name} size={24} />
              <span className="text-sm">
                You understood <strong>{m.about_name}</strong>
              </span>
            </div>
            <ScoreBar before={pct(m.pre)} after={pct(m.post)} />
          </li>
        ))}
        {g.pre !== null || g.post !== null ? (
          <li className="border-t hairline pt-3">
            <span className="label-mono text-ink-2">Everyone, on average</span>
            <ScoreBar before={pct(g.pre)} after={pct(g.post)} />
          </li>
        ) : null}
      </ul>
      {waiting.length ? (
        <p className="mt-3 text-sm text-ink-2">
          Your score for {waiting.join(", ")} appears once {waiting.length > 1 ? "they’ve" : "they’ve"} said where they stand on these statements
          themselves.
        </p>
      ) : null}
    </Card>
  );
}

function ScoreBar({ before, after }: { before: number | null; after: number | null }) {
  const delta = before !== null && after !== null ? after - before : null;
  return (
    <div className="mt-1.5">
      <div className="relative h-3 rounded-full bg-paper-2" role="img" aria-label={`Before ${before ?? "–"}%, after ${after ?? "–"}%`}>
        {before !== null ? <div className="absolute inset-y-0 left-0 rounded-full bg-rule" style={{ width: `${before}%` }} /> : null}
        {after !== null ? <div className="absolute inset-y-0 left-0 rounded-full bg-agree transition-all duration-700" style={{ width: `${after}%`, opacity: 0.9 }} /> : null}
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs text-ink-2">
        <span>before {before ?? "–"}%</span>
        <span className={delta && delta > 0 ? "font-semibold text-agree" : ""}>
          after {after ?? "–"}%{delta !== null ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}
        </span>
      </div>
    </div>
  );
}

/* ======================================================================= Steelman Exchange */

export function SteelmanExchange({ ch, act }: { ch: any; act: Act }) {
  const sm = ch.steelmen;
  const others: Member[] = ch.members.filter((m: Member) => !m.is_me);
  const [subject, setSubject] = useState(others[0]?.user_id ?? "");
  const [text, setText] = useState("");
  if (!sm) return null;
  const forMe = sm.items.filter((s: any) => s.about_me && s.rating === null);
  const mine = sm.items.filter((s: any) => s.is_mine);
  const accepted = sm.items.filter((s: any) => s.accepted && !s.is_mine && !s.about_me);
  const subjectName = others.find((o) => o.user_id === subject)?.name ?? "them";

  return (
    <Card>
      <SectionTitle kicker="Steelman Exchange · optional">Can you say their view better than they can?</SectionTitle>
      <p className="text-sm text-ink-2">
        Write someone else’s position in your own words, as strongly and fairly as you can. They rate it from 1 to 5. Only steelmen they
        rate 4 or 5 are shown to the group; anything else stays between the two of you.
      </p>

      {forMe.map((s: any) => (
        <RateCard key={s.id} s={s} act={act} />
      ))}

      {mine.length ? (
        <ul className="mt-4 space-y-3">
          {mine.map((s: any) => (
            <li key={s.id} className="rounded-md border hairline bg-white p-3">
              <div className="label-mono text-ink-2">
                Your steelman of {s.subject_name} · attempt {s.attempt}
              </div>
              <p className="font-body mt-1">{s.text}</p>
              <p className="mt-1 text-sm">
                {s.rating === null ? (
                  <span className="text-ink-2">Waiting for {s.subject_name} to rate it.</span>
                ) : (
                  <>
                    <Stars n={s.rating} /> {s.accepted ? <strong className="text-agree">Accepted by {s.subject_name}</strong> : <span>Not quite yet</span>}
                    {s.feedback ? <span className="block text-ink-2">“{s.feedback}”</span> : null}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {sm.open && others.length && !ch.paused ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            Steelman
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-md border hairline bg-white px-2 py-1" aria-label="Whose view">
              {others.map((o) => (
                <option key={o.user_id} value={o.user_id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <TextArea
            rows={3}
            className="mt-2"
            aria-label="Your steelman"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`In ${subjectName}’s best words: what do they believe, and why does it make sense?`}
          />
          <Button
            className="mt-2"
            variant="quiet"
            disabled={text.trim().length < 10}
            onClick={async () => {
              await act(`/chambers/${ch.id}/steelmen`, { subject_id: subject, text });
              setText("");
            }}
          >
            Send to {subjectName} to rate
          </Button>
        </div>
      ) : null}

      {accepted.length ? (
        <div className="mt-5 border-t hairline pt-3">
          <div className="label-mono text-agree">Accepted steelmen</div>
          <ul className="mt-2 space-y-2">
            {accepted.map((s: any) => (
              <li key={s.id} className="text-sm">
                <strong>{s.author_name}</strong> on <strong>{s.subject_name}</strong>’s view: <span className="font-body">“{s.text}”</span> <Stars n={s.rating} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function RateCard({ s, act }: { s: any; act: Act }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  return (
    <div className="mt-4 rounded-md border border-delegate/50 bg-delegate-tint/30 p-3">
      <div className="label-mono text-delegate">{s.author_name} tried to put your view in their words</div>
      <p className="font-body mt-1">“{s.text}”</p>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-sm" role="radiogroup" aria-label="How well does this capture your view?">
        <span className="mr-1">Would you sign this?</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} of 5`}
            onClick={() => setRating(n)}
            className={`h-8 w-8 rounded-full border text-sm ${rating >= n ? "border-ink bg-ink text-paper" : "hairline bg-white"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <TextArea rows={1} className="mt-2" aria-label="What's missing" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What’s missing or off? (only they see this)" />
      <Button className="mt-2" disabled={!rating} onClick={() => act(`/steelmen/${s.id}/rate`, { rating, feedback })}>
        Rate
      </Button>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} of 5`} className="font-mono text-xs">
      {"★".repeat(n)}
      <span className="text-rule">{"★".repeat(5 - n)}</span>
    </span>
  );
}

/* ======================================================================= Crux what-if + evidence board */

/** Toggle a confirmed crux and see whose position would move, by their own admission. */
export function CruxWhatIf({ ch }: { ch: any }) {
  const confirmed = ch.cruxes.filter((c: any) => c.confirmed);
  const [on, setOn] = useState<string[]>([]);
  if (!ch.cruxes.length) return null;
  const moved = new Set(ch.cruxes.filter((c: any) => on.includes(c.id)).map((c: any) => c.party_id));
  const diffs = ch.graph.nodes.filter((n: any) => n.kind === "DISAGREEMENT");
  return (
    <section className="mx-auto max-w-[720px]">
      <h2 className="label-mono border-b hairline pb-2 text-crux">What if…</h2>
      <p className="mt-2 text-sm text-ink-2">
        Each crux is something a person said would change their mind. Suppose one turned out to be false: see what would move. Only cruxes
        people confirmed themselves can be toggled.
      </p>
      <ul className="mt-3 space-y-2">
        {ch.cruxes.map((c: any) => (
          <li key={c.id}>
            <label className={`flex items-start gap-3 rounded-md border p-3 ${on.includes(c.id) ? "border-crux bg-[#FFF4ED]" : "hairline bg-white"} ${c.confirmed ? "cursor-pointer" : "opacity-60"}`}>
              <input
                type="checkbox"
                className="mt-1 accent-[#C2410C]"
                disabled={!c.confirmed}
                checked={on.includes(c.id)}
                onChange={(e) => setOn(e.target.checked ? [...on, c.id] : on.filter((x) => x !== c.id))}
              />
              <span className="text-sm">
                Suppose it’s <em>not</em> true that “{c.text}”
                <span className="block text-xs text-ink-2">
                  {c.party_name}’s crux · {c.confirmed ? "confirmed by them" : c.confirmed === false ? "they said this isn’t it" : "not confirmed yet"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {on.length ? (
        <div className="mt-3 rounded-md border border-crux/40 bg-white p-3 text-sm" aria-live="polite">
          {ch.members
            .filter((m: Member) => moved.has(m.user_id))
            .map((m: Member) => (
              <p key={m.user_id}>
                <strong>{m.is_me ? "You" : m.name}</strong> said this would change {m.is_me ? "your" : "their"} mind.
              </p>
            ))}
          {diffs
            .filter((d: any) => d.party_ids.some((p: string) => moved.has(p)))
            .map((d: any) => (
              <p key={d.id} className="mt-1 text-ink-2">
                <TypeChip type={d.claim_type} /> could shift: {d.text}
              </p>
            ))}
          {!confirmed.length ? null : (
            <p className="mt-2 text-xs text-ink-2">This is what people said about themselves, not a prediction by the Mediator.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Put sources side by side for factual or predictive differences and cruxes: 'let's check'. */
export function EvidenceBoard({ ch, act, refresh }: { ch: any; act: Act; refresh: () => void }) {
  const targets = [
    ...ch.graph.nodes.filter((n: any) => n.kind === "DISAGREEMENT").map((n: any) => ({ id: n.id, label: n.text, type: n.claim_type })),
    ...ch.cruxes.map((c: any) => ({ id: c.id, label: `${c.party_name}’s crux: ${c.text}`, type: "CRUX" })),
  ];
  const checkable = targets.filter((t) => ["FACT", "PREDICTION", "CRUX"].includes(t.type));
  const [target, setTarget] = useState(checkable[0]?.id ?? targets[0]?.id ?? "");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [stance, setStance] = useState("supports");
  if (!targets.length) return null;
  const byTarget = (id: string) => ch.evidence.filter((e: any) => e.target_id === id);
  const shown = targets.filter((t) => byTarget(t.id).length);
  const STANCE: Record<string, string> = { supports: "Supports it", challenges: "Challenges it", context: "Context" };

  return (
    <section className="mx-auto max-w-[720px]">
      <h2 className="label-mono border-b hairline pb-2 text-ink-2">Let’s check: evidence board</h2>
      <p className="mt-2 text-sm text-ink-2">
        Some differences can be settled by looking things up together. Add sources side by side. Nobody “wins” here; the point is to look
        at the same things.
      </p>
      {shown.map((t) => (
        <div key={t.id} className="mt-4">
          <p className="text-sm">
            {t.type === "CRUX" ? <span className="text-crux">◆ </span> : <TypeChip type={t.type} />} {t.label}
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {["supports", "challenges", "context"].map((st) => (
              <div key={st} className="rounded-md border hairline bg-white/70 p-2">
                <div className="label-mono text-ink-2">{STANCE[st]}</div>
                <ul className="mt-1 space-y-2 text-sm">
                  {byTarget(t.id)
                    .filter((e: any) => e.stance === st)
                    .map((e: any) => (
                      <li key={e.id}>
                        {e.url ? (
                          <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                            {e.text}
                          </a>
                        ) : (
                          e.text
                        )}
                        <span className="block text-xs text-ink-2">
                          added by {e.author_name}
                          {e.is_mine ? (
                            <button className="ml-2 underline" onClick={async () => { await api(`/evidence/${e.id}`, { method: "DELETE" }); refresh(); }}>
                              remove
                            </button>
                          ) : null}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!ch.paused && !ch.retention?.purged ? (
        <Card className="mt-4">
          <label className="block text-sm">
            About
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded-md border hairline bg-white px-2 py-1.5">
              {(checkable.length ? checkable : targets).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label.length > 90 ? t.label.slice(0, 88) + "…" : t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input aria-label="What it shows" className="rounded-md border hairline bg-white px-3 py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="What it shows" />
            <input aria-label="Link (optional)" className="rounded-md border hairline bg-white px-3 py-2" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (optional)" />
            <select aria-label="Stance" value={stance} onChange={(e) => setStance(e.target.value)} className="rounded-md border hairline bg-white px-2 py-2">
              {Object.entries(STANCE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <Button
            className="mt-2"
            variant="quiet"
            disabled={text.trim().length < 3}
            onClick={async () => {
              await act(`/chambers/${ch.id}/evidence`, { target_id: target, text, url: url || null, stance });
              setText("");
              setUrl("");
            }}
          >
            Add to the board
          </Button>
        </Card>
      ) : null}
    </section>
  );
}

/* ======================================================================= Position Record prompt */

export function MindChangePrompt({ ch }: { ch: any }) {
  const [text, setText] = useState("");
  const [pub, setPub] = useState(false);
  const [done, setDone] = useState(false);
  if (done)
    return <p className="mt-5 border-t hairline pt-4 text-sm text-agree">Added to your Position Record (Me → Your record).</p>;
  return (
    <div className="mt-5 border-t hairline pt-4">
      <div className="label-mono text-ink-2">Position Record</div>
      <p className="mt-1 text-sm text-ink-2">Did anything here change your mind, even a little? Changing your mind is a strength; your record keeps it.</p>
      <TextArea rows={2} className="mt-2" aria-label="What changed your mind" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. “I used to think equal rent was obviously fair. Room size matters more than I thought.”" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> Show on my public profile
        </label>
        <Button
          variant="quiet"
          disabled={text.trim().length < 5}
          onClick={async () => {
            await api("/me/mind-changes", { body: { text, chamber_id: ch.id, is_public: pub } });
            setDone(true);
          }}
        >
          Add to my record
        </Button>
      </div>
    </div>
  );
}
