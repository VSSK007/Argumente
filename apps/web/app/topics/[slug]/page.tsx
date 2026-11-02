"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api, useMe, usePoll } from "@/lib/api";
import { Button, Card, ErrorNote, SectionTitle } from "@/components/ui";

// Muted categorical colours for groups (all pass 3:1 against paper for graphics).
const GROUP_COLOR: Record<string, string> = { A: "#3B5BDB", B: "#A61E4D", C: "#0B7285", D: "#7A5F30" };
const VOTE_LABEL: Record<number, string> = { 1: "Agree", [-1]: "Disagree", 0: "Pass" };

export default function TopicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { me } = useMe();
  const { data: t, reload, error: loadError } = usePoll<any>(`/topics/${slug}`, 8000);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (loadError && !t) return <ErrorNote error={loadError.message} />;
  if (!t) return <p className="text-ink-2">Loading…</p>;

  const unvoted = t.statements.filter((s: any) => !(s.id in t.my_votes));
  const next = unvoted[0];
  const text = (id: string) => t.statements.find((s: any) => s.id === id)?.text ?? "";
  const open = t.status === "OPEN";

  async function act(fn: () => Promise<any>) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-10">
      <header>
        <Link href="/topics" className="label-mono text-ink-2 hover:text-ink">
          ← Public topics
        </Link>
        <h1 className="mt-1 font-display text-4xl leading-tight">{t.question}</h1>
        {t.description ? <p className="prose-body mt-2 max-w-2xl text-ink-2">{t.description}</p> : null}
        <p className="label-mono mt-2 text-ink-2">
          {t.participants} people · {t.statements.length} statements · votes are anonymous{t.status === "CLOSED" ? " · closed" : ""}
        </p>
      </header>

      <ErrorNote error={error} />

      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        {/* ---------------------------------------------------------------- vote */}
        <Card>
          <SectionTitle kicker={me ? `${t.statements.length - unvoted.length} of ${t.statements.length} voted` : "Vote"}>
            {next ? "What do you think?" : "You’ve voted on everything"}
          </SectionTitle>
          {!me ? (
            <p className="text-sm">
              <Link href={`/login?next=/topics/${slug}`} className="underline">
                Sign in
              </Link>{" "}
              to vote and add statements. Your votes stay anonymous.
            </p>
          ) : next && open ? (
            <div>
              <p key={next.id} className="demo-in font-display text-2xl leading-snug">
                “{next.text}”
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[1, -1, 0].map((v) => (
                  <Button key={v} variant={v === 0 ? "ghost" : "secondary"} onClick={() => act(() => api(`/topic-statements/${next.id}/vote`, { body: { vote: v } }))}>
                    {VOTE_LABEL[v]}
                  </Button>
                ))}
              </div>
              <button className="mt-3 text-xs text-ink-2 underline" onClick={() => act(() => api("/reports", { body: { target_type: "statement", target_id: next.id, reason: "Reported from topic page" } }))}>
                Report this statement
              </button>
            </div>
          ) : (
            <p className="text-sm text-ink-2">{open ? "Add a statement others haven’t said yet, or come back as more are added." : "This topic is closed."}</p>
          )}
          {me && open ? (
            <div className="mt-6 border-t hairline pt-4">
              <label className="block text-sm">
                Add a statement (one idea, under 280 characters)
                <textarea
                  className="prose-body mt-1 w-full rounded-md border hairline bg-white p-2 outline-none focus:border-ink"
                  rows={2}
                  maxLength={280}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-xs text-ink-2">{draft.length}/280</span>
                <Button
                  variant="quiet"
                  disabled={draft.trim().length < 5}
                  onClick={() =>
                    act(async () => {
                      await api(`/topics/${slug}/statements`, { body: { text: draft } });
                      setDraft("");
                    })
                  }
                >
                  Add statement
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        {/* ---------------------------------------------------------------- landscape */}
        <Card>
          <SectionTitle kicker="Opinion landscape">How people group</SectionTitle>
          <Landscape t={t} />
        </Card>
      </div>

      {t.consensus.length ? (
        <section>
          <SectionTitle kicker="Common ground">What every group agrees on</SectionTitle>
          <ul className="space-y-2">
            {t.consensus.map((c: any) => (
              <li key={c.statement_id} className="prose-body border-l-2 border-agree pl-3">
                “{c.text}” <span className="label-mono text-agree">{Math.round(c.min_group_agree * 100)}%+ agree in every group</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {t.divisive.length ? (
        <section>
          <SectionTitle kicker="What divides people">Where the groups split</SectionTitle>
          <div className="space-y-4">
            {t.divisive.map((d: any) => (
              <Card key={d.statement_id} className="p-4">
                <p className="prose-body">“{d.text}”</p>
                <div className="mt-2 space-y-1">
                  {Object.entries(d.by_group).map(([g, r]: any) => (
                    <div key={g} className="flex items-center gap-2 text-xs">
                      <span className="w-16 font-mono">Group {g}</span>
                      <div className="h-2 flex-1 rounded-full bg-paper-2">
                        <div className="h-2 rounded-full" style={{ width: `${Math.round(r * 100)}%`, background: GROUP_COLOR[g] }} />
                      </div>
                      <span className="w-20 text-right font-mono">{Math.round(r * 100)}% agree</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/chambers/new?template=disagreement&title=${encodeURIComponent(d.text.slice(0, 80))}&question=${encodeURIComponent(`${t.question} In particular: “${d.text}”`)}`}
                  className="mt-3 inline-block text-sm underline"
                >
                  Take this to a private Chamber with people you know →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {t.groups.length ? (
        <section>
          <SectionTitle kicker="Opinion groups">What makes each group distinct</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {t.groups.map((g: any) => (
              <Card key={g.label} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: GROUP_COLOR[g.label] }} aria-hidden />
                  <span className="font-display text-xl">Group {g.label}</span>
                  <span className="label-mono text-ink-2">{g.size} people</span>
                  {t.my_group === g.label ? <span className="label-mono rounded bg-ink px-1.5 py-0.5 text-paper">you</span> : null}
                </div>
                <ul className="mt-2 space-y-2 text-sm">
                  {g.distinctive.map((r: any) => (
                    <li key={r.statement_id}>
                      <span className="font-body">“{r.text}”</span>
                      <span className="block text-xs text-ink-2">
                        {Math.round(r.agree * 100)}% agree here vs {Math.round(r.others_agree * 100)}% elsewhere
                      </span>
                    </li>
                  ))}
                  {!g.distinctive.length ? <li className="text-ink-2">No strongly distinctive statements yet.</li> : null}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle kicker="All statements">Everything said so far</SectionTitle>
        <ul className="divide-y hairline border-y hairline">
          {t.statements.map((s: any) => {
            const total = s.agree + s.disagree + s.pass;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-body">“{s.text}”</span>
                <span className="flex items-center gap-3 font-mono text-xs text-ink-2">
                  <span>
                    {s.agree} agree · {s.disagree} disagree · {s.pass} pass{total ? "" : " · no votes yet"}
                  </span>
                  {s.id in t.my_votes ? <span className="rounded border hairline px-1.5">you: {VOTE_LABEL[t.my_votes[s.id]].toLowerCase()}</span> : null}
                  {t.is_creator ? (
                    <button className="underline" onClick={() => act(() => api(`/topic-statements/${s.id}/hide`, { body: {} }))}>
                      hide
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        {t.is_creator && open ? (
          <button className="mt-3 text-xs text-ink-2 underline" onClick={() => act(() => api(`/topics/${slug}/close`, { body: {} }))}>
            Close this topic to new votes
          </button>
        ) : null}
      </section>
    </div>
  );
}

/** People who voted identically share a position; fan them out in a small sunflower spiral so
 *  every person is visible (golden-angle placement, deterministic). */
function spread(points: any[]) {
  const seen = new Map<string, number>();
  return points.map((p) => {
    const key = `${p.x},${p.y}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const r = n ? 6 * Math.sqrt(n) : 0;
    const a = n * 2.39996;
    return { p, dx: r * Math.cos(a), dy: r * Math.sin(a) };
  });
}

/** Each dot is an anonymous person placed by how they voted; nearby dots voted alike. */
function Landscape({ t }: { t: any }) {
  if (!t.points.length) {
    return (
      <p className="text-sm text-ink-2">
        The map appears once at least {t.min_group * 2} people have each voted on 3 or more statements. Groups are only shown when every
        group has at least {t.min_group} people, so nobody’s individual votes can be worked out.
      </p>
    );
  }
  const W = 320;
  const H = 240;
  const P = 18;
  const px = (x: number) => P + ((x + 1) / 2) * (W - 2 * P);
  const py = (y: number) => P + ((1 - y) / 2) * (H - 2 * P);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Opinion map of ${t.mapped} people in ${t.groups.length || "no"} groups`}>
        <rect x="0" y="0" width={W} height={H} rx="8" fill="#FFFFFF" stroke="#D9D3C7" />
        <line x1={W / 2} y1={P} x2={W / 2} y2={H - P} stroke="#EFEAE0" />
        <line x1={P} y1={H / 2} x2={W - P} y2={H / 2} stroke="#EFEAE0" />
        {spread(t.points).map(({ p, dx, dy }, i: number) => (
          <circle
            key={i}
            cx={px(p.x) + dx}
            cy={py(p.y) + dy}
            r={p.me ? 7 : 5}
            fill={p.group ? GROUP_COLOR[p.group] : "#9A958C"}
            fillOpacity={0.75}
            stroke={p.me ? "#1A1A1A" : "none"}
            strokeWidth={p.me ? 2.5 : 0}
          />
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-3 text-xs text-ink-2">
        {t.groups.map((g: any) => (
          <span key={g.label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLOR[g.label] }} aria-hidden /> Group {g.label} ({g.size})
          </span>
        ))}
        {t.points.some((p: any) => p.me) ? <span>Ringed dot: you</span> : null}
        {!t.groups.length ? <span>Not enough people yet to form groups of {t.min_group}+.</span> : null}
      </figcaption>
    </figure>
  );
}
