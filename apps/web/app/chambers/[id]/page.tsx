"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api, usePoll } from "@/lib/api";
import {
  Button,
  Card,
  DelegateBadge,
  EngineThinking,
  EpistemicTag,
  ErrorNote,
  Glyph,
  HumanAvatar,
  MediatorBadge,
  SectionTitle,
  StateRail,
  TextArea,
  TypeChip,
} from "@/components/ui";
import { MapView } from "@/components/MapView";

type Member = {
  user_id: string;
  name: string;
  alias: string;
  role: string;
  is_me: boolean;
  delegate: { handle: string; name: string; glyph_seed: string } | null;
  intake_status: "NONE" | "DRAFT" | "ENDORSED";
};

export default function ChamberPage() {
  const { id } = useParams<{ id: string }>();
  const { data: ch, setData, error: loadError } = usePoll<any>(`/chambers/${id}`, 2000);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, body: unknown = {}) {
    setError(null);
    try {
      const v = await api(path, { body });
      if (v && v.id === id) setData(v);
      else setData(await api(`/chambers/${id}`));
      return v;
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loadError && !ch) return <ErrorNote error={loadError.message} />;
  if (!ch) return <p className="text-ink-2">Loading…</p>;

  const me: Member = ch.members.find((m: Member) => m.is_me);
  const running = ch.run && ch.run.status === "RUNNING";
  const failed = ch.run && (ch.run.status === "FAILED" || (ch.run.status === "CANCELLED" && !ch.paused));
  const nameOf = (uid: string) => ch.members.find((m: Member) => m.user_id === uid)?.name ?? "Someone";

  return (
    <div className="space-y-8">
      {/* -------- header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="label-mono text-ink-2">{ch.template} Chamber</div>
            <h1 className="font-display text-3xl md:text-4xl">{ch.title}</h1>
            <p className="prose-body mt-1 text-ink-2">{ch.question}</p>
          </div>
          {ch.state !== "CLOSED" ? (
            ch.paused ? (
              <Button variant="secondary" onClick={() => act(`/chambers/${id}/resume`)}>
                ▶ Resume
              </Button>
            ) : (
              <Button variant="quiet" onClick={() => act(`/chambers/${id}/pause`)} title="Anyone can pause at any time">
                ❚❚ Pause
              </Button>
            )
          ) : null}
        </div>
        <StateRail state={ch.state} />
        <Members members={ch.members} state={ch.state} />
      </header>

      <ErrorNote error={error} />

      {ch.engine_mode === "local-fallback" || ch.engine_mode === "mixed" ? (
        <p className="rounded-md bg-engine-tint/60 px-3 py-2 text-xs text-engine">
          Some of this analysis used the offline engine because a Claude API call failed (see the API logs). Results are more literal than usual.
        </p>
      ) : null}

      {ch.safety ? <SafetyPanel s={ch.safety} onResume={() => act(`/chambers/${id}/resume`)} /> : null}

      {ch.paused && !ch.safety ? (
        <Card className="border-ink">
          <p className="font-display text-xl">This Chamber is paused{ch.paused_by ? ` by ${ch.paused_by}` : ""}.</p>
          <p className="text-sm text-ink-2">Nothing moves forward until it’s resumed{ch.paused_by ? ` by ${ch.paused_by}` : ""}.</p>
        </Card>
      ) : null}

      {running ? <EngineThinking step={ch.run.step} /> : null}
      {failed ? (
        <Card className="border-crux/50">
          <p className="text-sm">
            The Mediator couldn’t finish ({ch.run.status.toLowerCase()}){ch.run.error ? `: ${ch.run.error}` : ""}.
          </p>
          <Button className="mt-2" variant="secondary" onClick={() => act(`/chambers/${id}/advance`, { action: "retry" })}>
            Retry
          </Button>
        </Card>
      ) : null}

      {/* -------- intake */}
      {ch.state === "INTAKE" ? <Intake ch={ch} me={me} act={act} /> : null}

      {/* -------- restatement gate */}
      {ch.state === "RESTATEMENT" || ch.state === "MAPPING" ? <Restatements ch={ch} act={act} /> : null}

      {/* -------- map and resolution */}
      {ch.map ? (
        <>
          <MapView
            map={{
              headline: ch.map.headline,
              summary: ch.map.summary,
              stands: ch.map.where_you_stand.map((w: any) => ({
                label: nameOf(w.party_id),
                text: w.text,
                written_by: ch.restatements.find((r: any) => r.id === w.restatement_id)?.written_by,
              })),
              shared: ch.map.shared,
              differences: ch.map.differences,
              cruxes: ch.map.cruxes.map((c: any) => ({ label: nameOf(c.party_id), text: c.text, confirmed: c.confirmed })),
              open_questions: ch.map.open_questions,
            }}
          />
          <GraphDetails ch={ch} />
          {ch.state === "MAP" && !ch.paused ? (
            <Card className="mx-auto max-w-[720px]">
              <SectionTitle kicker="What next?">You understand each other. Now what?</SectionTitle>
              <p className="text-sm text-ink-2">
                Disagreeing is a legitimate outcome. You can close the Chamber as understood, or ask the Mediator for options that
                serve everyone’s stakes.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => act(`/chambers/${id}/advance`, { action: "explore_options" })}>Explore options</Button>
                <Button variant="secondary" onClick={() => act(`/chambers/${id}/advance`, { action: "close_understood" })}>
                  Close: understood, still disagree
                </Button>
              </div>
            </Card>
          ) : null}
          {ch.state === "RESOLUTION" ? <Resolution ch={ch} act={act} /> : null}
          {ch.state === "CLOSED" ? (
            <Card className="mx-auto max-w-[720px]">
              <div className="label-mono text-ink-2">Closed</div>
              <p className="font-display text-2xl">
                {ch.closed_state === "AGREED"
                  ? "Agreed, and approved by everyone."
                  : ch.closed_state === "UNDERSTOOD"
                    ? "Understood each other. Still disagree, and that’s allowed."
                    : "Abandoned."}
              </p>
              {ch.agreement.items.length ? <AgreementList ch={ch} act={act} readOnly /> : null}
            </Card>
          ) : null}
          <Publish ch={ch} act={act} />
        </>
      ) : null}

      {ch.state === "INTAKE" && ch.is_creator ? (
        <div className="text-right">
          <button className="text-xs text-ink-2 underline" onClick={() => act(`/chambers/${id}/advance`, { action: "abandon" })}>
            Abandon this Chamber
          </button>
        </div>
      ) : null}

      <Record events={ch.events} />
    </div>
  );
}

/* ================================================================= members */

function Members({ members, state }: { members: Member[]; state: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      {members.map((m) => (
        <div key={m.user_id} className="flex items-center gap-2 rounded-full border hairline bg-white/70 py-1 pl-1 pr-3">
          <HumanAvatar name={m.name} size={26} />
          {m.delegate ? <Glyph seed={m.delegate.glyph_seed} size={20} /> : null}
          <span className="text-sm">
            {m.name}
            {m.is_me ? <span className="text-ink-2"> (you)</span> : null}
          </span>
          {state === "INTAKE" ? (
            <span className={`label-mono ${m.intake_status === "ENDORSED" ? "text-agree" : "text-ink-2"}`}>
              {m.intake_status === "ENDORSED" ? "✓ ready" : "writing…"}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ================================================================= intake */

function Intake({ ch, me, act }: { ch: any; me: Member; act: (p: string, b?: unknown) => Promise<any> }) {
  const [text, setText] = useState<string>(ch.my_intake?.text ?? "");
  const [editing, setEditing] = useState(!ch.my_intake || ch.my_intake.status !== "ENDORSED");
  const [unknowns, setUnknowns] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const invite = typeof window !== "undefined" ? `${window.location.origin}/join/${ch.invite_token}` : "";
  const allReady = ch.members.length >= 2 && ch.members.every((m: Member) => m.intake_status === "ENDORSED");
  const isDelegateDraft = ch.my_intake?.authored_by === "delegate" && ch.my_intake?.text === text;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <Card>
        <SectionTitle kicker="Private · only you can see this">Your position</SectionTitle>
        <p className="mb-3 text-sm text-ink-2">{ch.template_prompt} Others will never see your exact words; the Mediator explains your view and you check it.</p>
        {editing ? (
          <>
            {isDelegateDraft && me.delegate ? (
              <div className="mb-2 flex items-center gap-2">
                <DelegateBadge name={me.delegate.name} ownerName={me.name} seed={me.delegate.glyph_seed} />
                <EpistemicTag status="DRAFT" />
              </div>
            ) : null}
            <TextArea
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say what you think and why. What matters most to you here?"
              className={isDelegateDraft ? "border-l-2 border-l-delegate bg-delegate-tint/40" : ""}
            />
            {unknowns?.length ? (
              <div className="mt-2 rounded-md bg-delegate-tint/60 p-2 text-sm text-delegate">
                {unknowns.map((u, i) => (
                  <div key={i}>• {u}</div>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                onClick={async () => {
                  const v = await act(`/chambers/${ch.id}/intake`, { text, endorse: true });
                  if (v && !v.safety_paused) setEditing(false);
                }}
                disabled={text.trim().length < 3 || ch.paused}
              >
                Endorse &amp; submit
              </Button>
              <Button variant="secondary" onClick={() => act(`/chambers/${ch.id}/intake`, { text, endorse: false })} disabled={text.trim().length < 3 || ch.paused}>
                Save draft
              </Button>
              {me.delegate ? (
                <Button
                  variant="ghost"
                  disabled={ch.paused}
                  onClick={async () => {
                    const r = await api(`/chambers/${ch.id}/delegate-draft`, { body: {} }).catch((e) => ({ error: e.message }));
                    if (r.error) return setUnknowns([r.error]);
                    setUnknowns(r.unknowns?.length ? r.unknowns.map((u: string) => `Your Delegate doesn't know: ${u}`) : null);
                    if (r.drafted) {
                      const v = await api(`/chambers/${ch.id}`);
                      setText(v.my_intake?.text ?? "");
                    }
                  }}
                >
                  <Glyph seed={me.delegate.glyph_seed} size={16} /> Draft with my Delegate
                </Button>
              ) : (
                <Link href="/onboarding" className="text-xs text-ink-2 underline">
                  Create a Delegate to get drafts
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <EpistemicTag status="ENDORSED" />
              <span className="text-xs text-ink-2">{ch.my_intake.authored_by === "delegate" ? "Drafted by your Delegate, endorsed by you" : "In your own words"}</span>
            </div>
            <p className="prose-body mt-2 whitespace-pre-wrap">{ch.my_intake.text}</p>
            <Button variant="ghost" className="mt-2" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        )}
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="label-mono text-ink-2">Invite the people involved</div>
          <p className="mt-1 text-sm text-ink-2">They can join without a Delegate.</p>
          <div className="mt-2 break-all rounded-md bg-paper-2 p-2 font-mono text-xs">{invite}</div>
          <Button
            variant="secondary"
            className="mt-2 w-full"
            onClick={async () => {
              await navigator.clipboard?.writeText(invite);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy invite link"}
          </Button>
        </Card>
        <Card>
          <div className="label-mono text-ink-2">Next step</div>
          <p className="mt-1 text-sm">
            {ch.members.length < 2
              ? "Waiting for at least one more person."
              : allReady
                ? "Everyone has endorsed a position."
                : "Waiting for everyone to endorse their position."}
          </p>
          <Button className="mt-3 w-full" disabled={!allReady || ch.paused} onClick={() => act(`/chambers/${ch.id}/advance`, { action: "analyze" })}>
            Ask the Mediator to read
          </Button>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================= restatement gate */

function Restatements({ ch, act }: { ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const accepted = ch.restatements.filter((r: any) => r.status === "ACCEPTED").length;
  return (
    <section className="space-y-4">
      <SectionTitle kicker={`Restatement gate · ${accepted} of ${ch.restatements.length} accepted`}>Is this what you mean?</SectionTitle>
      <p className="prose-body max-w-2xl text-ink-2">
        The Mediator has explained each person’s view to the group. Nobody gets to propose solutions until everyone says{" "}
        <em>“yes, that’s me.”</em> Check yours; read everyone else’s.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {ch.restatements
          .slice()
          .sort((a: any, b: any) => Number(b.is_mine) - Number(a.is_mine))
          .map((r: any) => (
            <RestatementCard key={r.id} r={r} ch={ch} act={act} />
          ))}
      </div>
      <Cruxes ch={ch} act={act} />
    </section>
  );
}

function RestatementCard({ r, ch, act }: { r: any; ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const [mode, setMode] = useState<"idle" | "reject" | "write">("idle");
  const [text, setText] = useState("");
  return (
    <Card className={r.is_mine ? "border-ink" : ""}>
      <div className="flex items-center justify-between">
        <span className="font-display text-lg">{r.is_mine ? "Your view, as explained to the group" : `${r.of_name}’s view`}</span>
        <span className={`label-mono ${r.status === "ACCEPTED" ? "text-agree" : "text-ink-2"}`}>
          {r.status === "ACCEPTED" ? `✓ accepted by ${r.is_mine ? "you" : r.of_name}` : r.status === "REVISING" ? "revising…" : `awaiting ${r.is_mine ? "you" : r.of_name}`}
        </span>
      </div>
      <div className="mt-2 border-l-2 border-engine/50 pl-3">
        {r.written_by === "human" ? <EpistemicTag status="ENDORSED" /> : <MediatorBadge />}
        <p className="prose-body mt-1">{r.text}</p>
        <p className="mt-1 text-xs text-ink-2">Version {r.revision}</p>
      </div>
      {r.is_mine && r.status === "PENDING" && !ch.paused ? (
        mode === "idle" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => act(`/restatements/${r.id}/accept`)}>Yes, that’s me</Button>
            {r.can_write_own ? (
              <Button variant="secondary" onClick={() => setMode("write")}>
                Write it myself
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setMode("reject")}>
                Not quite
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <TextArea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === "reject" ? "What did it get wrong, or leave out?" : "How would you like your view explained to the group?"}
            />
            <div className="mt-2 flex gap-2">
              <Button
                disabled={text.trim().length < 3}
                onClick={async () => {
                  await act(`/restatements/${r.id}/${mode === "reject" ? "reject" : "write"}`, { [mode === "reject" ? "feedback" : "text"]: text });
                  setMode("idle");
                  setText("");
                }}
              >
                {mode === "reject" ? "Ask the Mediator to revise" : "Use my wording"}
              </Button>
              <Button variant="ghost" onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </div>
          </div>
        )
      ) : null}
    </Card>
  );
}

function Cruxes({ ch, act }: { ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const mine = ch.cruxes.filter((c: any) => c.is_mine);
  if (!mine.length) return null;
  return (
    <Card>
      <div className="label-mono text-crux">◆ Crux check · private to you</div>
      {mine.map((c: any) => (
        <div key={c.id} className="mt-2">
          <p className="prose-body">{c.question}</p>
          <p className="text-xs text-ink-2">The Mediator thinks your view hinges on: “{c.text}”</p>
          {c.confirmed === null ? (
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => act(`/cruxes/${c.id}/confirm`, { confirmed: true })}>
                Yes, that would change my mind
              </Button>
              <Button variant="ghost" onClick={() => act(`/cruxes/${c.id}/confirm`, { confirmed: false })}>
                No, that’s not it
              </Button>
            </div>
          ) : (
            <p className="label-mono mt-1 text-ink-2">{c.confirmed ? "Confirmed as a crux" : "Not a crux (hidden from the Map)"}</p>
          )}
        </div>
      ))}
    </Card>
  );
}

/* ================================================================= analysis details */

function GraphDetails({ ch }: { ch: any }) {
  const nodes = ch.graph.nodes;
  if (!nodes.length) return null;
  const groups: Record<string, any[]> = {};
  for (const n of nodes) (groups[n.kind] ??= []).push(n);
  const LABEL: Record<string, string> = {
    CLAIM: "Claims",
    ASSUMPTION: "Assumptions (Mediator's inference)",
    INTEREST: "Underlying interests",
    VALUE: "Shared ground",
    DISAGREEMENT: "Typed disagreements",
  };
  return (
    <details className="mx-auto max-w-[720px] rounded-lg border hairline bg-white/50 p-4">
      <summary className="cursor-pointer text-sm text-ink-2">Show the argument graph the Mediator built ({nodes.length} nodes)</summary>
      <div className="mt-4 space-y-5">
        {Object.entries(groups).map(([k, ns]) => (
          <div key={k}>
            <div className="label-mono text-ink-2">{LABEL[k] ?? k}</div>
            <ul className="mt-2 space-y-2">
              {ns.map((n) => (
                <li key={n.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {n.holder_name ? <span className="font-medium">{n.holder_name}</span> : null}
                    {n.claim_type ? <TypeChip type={n.claim_type} /> : null}
                    <EpistemicTag status={n.epistemic_status} />
                  </div>
                  <p className="font-body">{n.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

/* ================================================================= resolution & agreement */

function Resolution({ ch, act }: { ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const [text, setText] = useState("");
  return (
    <section className="mx-auto max-w-[720px] space-y-6">
      <SectionTitle kicker="Resolution">Options</SectionTitle>
      <div className="space-y-3">
        {ch.options.map((o: any, i: number) => (
          <Card key={i}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <MediatorBadge />
                <div className="mt-2 font-display text-xl">{o.title}</div>
                <p className="prose-body mt-1">{o.description}</p>
                <p className="mt-1 text-sm text-ink-2">Trade-offs: {o.trade_offs}</p>
              </div>
            </div>
            <Button variant="quiet" className="mt-3" disabled={ch.paused} onClick={() => act(`/chambers/${ch.id}/agreement/items`, { text: `${o.title}: ${o.description}`, from_option: true })}>
              Propose as an agreement item
            </Button>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle kicker="Agreement · nothing binds until everyone approves each item">What you’re agreeing to</SectionTitle>
        <AgreementList ch={ch} act={act} />
        <div className="mt-4">
          <TextArea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Propose an item in your own words, e.g. “Lisbon, 4 nights, max €600 each”" />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              disabled={text.trim().length < 3 || ch.paused}
              onClick={async () => {
                await act(`/chambers/${ch.id}/agreement/items`, { text });
                setText("");
              }}
            >
              Propose item
            </Button>
            <Button variant="secondary" onClick={() => act(`/chambers/${ch.id}/advance`, { action: "close_understood" })}>
              Close without agreement: understood
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

function AgreementList({ ch, act, readOnly }: { ch: any; act: (p: string, b?: unknown) => Promise<any>; readOnly?: boolean }) {
  if (!ch.agreement.items.length) return <p className="text-sm text-ink-2">No items proposed yet.</p>;
  return (
    <ul className="mt-2 space-y-3">
      {ch.agreement.items.map((it: any) => (
        <li key={it.id} className="rounded-md border hairline bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="prose-body">{it.text}</p>
            <span className={`label-mono shrink-0 ${it.status === "APPROVED" ? "text-agree" : it.status === "REJECTED" ? "text-crux" : "text-ink-2"}`}>{it.status.toLowerCase()}</span>
          </div>
          <p className="text-xs text-ink-2">
            {it.proposed_by_type === "engine" ? `Mediator's option, proposed by ${it.proposed_by_name}` : `Proposed by ${it.proposed_by_name}`}
          </p>
          {/* Approval row: one chip per person, never pre-checked */}
          <div className="mt-2 flex flex-wrap gap-2">
            {ch.members.map((m: Member) => {
              const d = it.decisions[m.user_id];
              return (
                <span key={m.user_id} className={`rounded-full border px-2 py-0.5 text-xs ${d === "approve" ? "border-agree text-agree" : d === "reject" ? "border-crux text-crux" : "hairline text-ink-2"}`}>
                  {d === "approve" ? "✓" : d === "reject" ? "✕" : "○"} {m.name}
                </span>
              );
            })}
          </div>
          {!readOnly && !ch.paused ? (
            <div className="mt-2 flex gap-2">
              <Button variant={it.my_decision === "approve" ? "primary" : "secondary"} onClick={() => act(`/agreement-items/${it.id}/decide`, { decision: "approve" })}>
                Approve
              </Button>
              <Button variant={it.my_decision === "reject" ? "danger" : "ghost"} onClick={() => act(`/agreement-items/${it.id}/decide`, { decision: "reject" })}>
                Reject
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* ================================================================= publish */

function Publish({ ch, act }: { ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const [showName, setShowName] = useState(false);
  const pub = ch.publication;
  const consented = pub ? Object.values(pub.consents).filter((c: any) => c.consent).length : 0;
  return (
    <Card className="mx-auto max-w-[720px]">
      <div className="label-mono text-ink-2">Share with the Commons</div>
      <p className="mt-1 text-sm text-ink-2">
        Publishing needs <strong>everyone’s</strong> consent. Names are replaced with “Participant A/B…” unless every person opts in to
        showing theirs. Anyone can withdraw consent later, and that unpublishes it.
      </p>
      {pub?.status === "PUBLISHED" ? (
        <p className="mt-2 text-sm">
          Published:{" "}
          <Link href={`/m/${pub.slug}`} className="underline">
            /m/{pub.slug}
          </Link>
        </p>
      ) : pub ? (
        <p className="mt-2 text-sm text-ink-2">
          {consented} of {ch.members.length} have consented.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {pub?.my_consent ? (
          <Button variant="secondary" onClick={() => act(`/chambers/${ch.id}/publish/consent`, { consent: false })}>
            Withdraw my consent
          </Button>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Show my real name
            </label>
            <Button variant="quiet" onClick={() => act(`/chambers/${ch.id}/publish/consent`, { consent: true, show_name: showName })}>
              I consent to publishing this Map
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

/* ================================================================= safety & record */

function SafetyPanel({ s, onResume }: { s: any; onResume: () => void }) {
  return (
    <Card className="border-crux">
      <div className="label-mono text-crux">Private to you</div>
      <p className="font-display mt-1 text-xl">{s.summary}</p>
      <p className="mt-1 text-sm text-ink-2">
        Something you wrote suggests this may not be a disagreement to mediate. We paused this Chamber quietly; others only see that it’s
        paused, not why. Argumenté isn’t therapy or a crisis service.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {s.links.map((l: any, i: number) => (
          <li key={i}>
            {l.url ? (
              <a href={l.url} target="_blank" rel="noreferrer" className="underline">
                {l.label}
              </a>
            ) : (
              <strong>{l.label}</strong>
            )}
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="mt-3" onClick={onResume}>
        I’m safe. Resume the Chamber.
      </Button>
    </Card>
  );
}

const EVENT_LABEL: Record<string, string> = {
  "chamber.created": "created the Chamber",
  "member.joined": "joined",
  "position.endorsed": "endorsed their position",
  "position.drafted": "got a Delegate draft",
  "state.changed": "moved the Chamber on",
  "engine.run.started": "Mediator started",
  "engine.run.completed": "Mediator finished",
  "engine.run.failed": "Mediator failed",
  "engine.run.cancelled": "Mediator stopped (paused)",
  "restatement.accepted": "accepted how their view was explained",
  "restatement.rejected": "asked for a revision",
  "restatement.created": "Mediator revised a restatement",
  "gate.passed": "Restatement gate passed",
  "map.generated": "Understanding Map drawn",
  "chamber.paused": "paused",
  "chamber.resumed": "resumed",
  "crux.confirmed": "confirmed a crux",
  "crux.rejected": "rejected a crux",
  "agreement.item.proposed": "proposed an agreement item",
  "agreement.item.approved": "approved an item",
  "agreement.item.rejected": "rejected an item",
  "chamber.closed": "closed the Chamber",
  "publication.consent.granted": "consented to publish",
  "publication.consent.revoked": "withdrew publishing consent",
  "publication.published": "Map published",
};

function Record({ events }: { events: any[] }) {
  return (
    <details className="rounded-lg border hairline p-4">
      <summary className="cursor-pointer text-sm text-ink-2">Record ({events.length} recent events)</summary>
      <ul className="mt-3 space-y-1 text-sm">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3">
            <span className="w-20 shrink-0 font-mono text-xs text-ink-2">{new Date(e.at).toLocaleTimeString()}</span>
            <span>
              {e.actor_type === "engine" ? "§ " : e.actor_type === "delegate" ? "◆ " : ""}
              {e.actor_name ? <strong>{e.actor_name} </strong> : null}
              {EVENT_LABEL[e.type] ?? e.type}
              {e.payload?.state ? ` → ${e.payload.state.toLowerCase()}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
