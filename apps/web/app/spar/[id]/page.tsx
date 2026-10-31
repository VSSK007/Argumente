"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api, usePoll } from "@/lib/api";
import { Button, Card, DelegateBadge, EpistemicTag, ErrorNote, HumanAvatar, MediatorBadge, SectionTitle, TextArea } from "@/components/ui";

export default function SparSession() {
  const { id } = useParams<{ id: string }>();
  const { data: s, setData } = usePoll<any>(`/spar/${id}`, 0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!s) return <p className="text-ink-2">Loading…</p>;

  async function send(path: string, body: unknown) {
    setError(null);
    try {
      setData(await api(path, { body }));
      setText("");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="label-mono text-ink-2">
        {s.mode === "rehearsal" ? `Rehearsal with ${s.target?.owner_name ?? "someone"}’s Delegate` : s.mode === "steelman" ? "Steelman" : "Devil’s Advocate"}
        {s.mode !== "rehearsal" ? ` · ${s.methodology}` : ""} · round {s.rounds}/{s.max_rounds}
      </div>
      <h1 className="mt-1 font-display text-3xl leading-tight">{s.claim}</h1>
      <ol className="mt-8 space-y-5">
        {s.turns.slice(1).map((t: any, i: number) => (
          <li
            key={i}
            className={t.role === "opponent" ? "border-l-2 border-engine/60 pl-4" : t.role === "delegate" ? "rounded-r-md border-l-2 border-delegate bg-delegate-tint/40 py-2 pl-4" : "pl-4"}
          >
            {t.role === "delegate" && s.target ? (
              <div className="flex flex-wrap items-center gap-2">
                <DelegateBadge name={s.target.name} ownerName={s.target.owner_name} seed={s.target.glyph_seed} />
                <EpistemicTag status="INFERRED" />
                <span className="text-xs text-ink-2">From {s.target.owner_name}’s public positions only. {s.target.owner_name} hasn’t seen this.</span>
              </div>
            ) : t.role === "opponent" ? (
              <div className="flex items-center gap-2">
                <MediatorBadge />
                <span className="label-mono text-ink-2">sparring partner · {t.attack_type}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-medium">
                <HumanAvatar name="You" size={22} /> You
              </div>
            )}
            <p className={`prose-body mt-1 ${t.role === "opponent" ? "italic" : ""}`}>{t.text}</p>
            {t.role === "delegate" && t.unknowns?.length ? (
              <ul className="mt-1 text-xs text-delegate">
                {t.unknowns.map((u: string, j: number) => (
                  <li key={j}>• Doesn’t know: {u}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      {s.status === "ACTIVE" ? (
        <Card className="mt-6">
          <TextArea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={s.mode === "rehearsal" ? "Say what you’d say to them." : "Defend, refine, or concede. Conceding a good point is a strength."} />
          <div className="mt-2 flex justify-between">
            <Button variant="ghost" onClick={() => send(`/spar/${id}/finish`, {})}>
              Finish &amp; get report
            </Button>
            <Button disabled={!text.trim()} onClick={() => send(`/spar/${id}/turn`, { response: text })}>
              Respond
            </Button>
          </div>
          <ErrorNote error={error} />
        </Card>
      ) : null}
      {s.report ? (
        <Card className="mt-8">
          <SectionTitle kicker="Robustness report">
            Verdict: <span className={s.report.verdict === "robust" ? "text-agree" : s.report.verdict === "revised" ? "text-delegate" : "text-engine"}>{s.report.verdict}</span>
          </SectionTitle>
          <p className="prose-body">
            <strong>Strongest objection:</strong> {s.report.strongest_objection}
          </p>
          <p className="prose-body mt-2">
            <strong>How you responded:</strong> {s.report.how_you_responded}
          </p>
          <ul className="prose-body mt-3 list-disc pl-5">
            {s.report.what_to_strengthen.map((x: string, i: number) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
