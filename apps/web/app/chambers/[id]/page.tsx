"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, useChamberStream, usePoll } from "@/lib/api";
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
import { MapView, type MapData } from "@/components/MapView";
import { ArgumentGraph } from "@/components/chamber/ArgumentGraph";
import { Timeline } from "@/components/chamber/Timeline";
import { CruxWhatIf, EvidenceBoard, MindChangePrompt, QuizPanel, ScoreCard, SteelmanExchange } from "@/components/chamber/Understanding";

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
  const reloadRef = useRef<() => void>(() => {});
  const [tick, setTick] = useState(0);
  const live = useChamberStream(id, () => {
    reloadRef.current();
    setTick((t) => t + 1);
  });
  // With a live stream, polling is only a slow safety net.
  const { data: ch, setData, error: loadError, reload } = usePoll<any>(`/chambers/${id}`, live ? 20000 : 2000);
  reloadRef.current = reload;
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"now" | "map" | "graph" | "timeline">("now");
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const skip = (phase: string) => setSkipped((x) => ({ ...x, [phase]: true }));

  async function act(path: string, body: unknown = {}) {
    setError(null);
    try {
      const v = await api(path, { body });
      if (v && v.id === id) setData(v);
      else setData(await api(`/chambers/${id}`));
      setTick((t) => t + 1);
      return v;
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loadError && !ch) return <ErrorNote error={loadError.message} />;
  if (!ch) return <ChamberSkeleton />;

  const me: Member = ch.members.find((m: Member) => m.is_me);
  const running = ch.run && ch.run.status === "RUNNING";
  const failed = ch.run && (ch.run.status === "FAILED" || (ch.run.status === "CANCELLED" && !ch.paused));
  const mapData = ch.map ? toMapData(ch) : null;
  const hasGraph = ch.graph.nodes.length > 0;
  const tabs = [
    { key: "now", label: "Now" },
    ...(mapData ? [{ key: "map", label: "Understanding Map" }] : []),
    ...(hasGraph ? [{ key: "graph", label: "Argument graph" }] : []),
    { key: "timeline", label: "Timeline" },
  ] as const;
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "now";

  return (
    <div className="space-y-6">
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StateRail state={ch.state} />
          <span className="label-mono text-ink-2" title={live ? "Updates appear instantly" : "Refreshing every few seconds"}>
            <span className={live ? "text-agree" : ""}>●</span> {live ? "live" : "syncing"}
          </span>
        </div>
        <Members ch={ch} />
      </header>

      <NowBanner ch={ch} me={me} running={!!running} onGo={activeTab !== "now" ? () => setTab("now") : undefined} />

      <nav className="flex gap-1 overflow-x-auto border-b hairline print:hidden" role="tablist" aria-label="Chamber views">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              activeTab === t.key ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <ErrorNote error={error} />

      {activeTab === "now" ? (
        <div className="space-y-8">
          {ch.lineage?.parent ? <ParentContext p={ch.lineage.parent} act={act} /> : null}

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

          {ch.state === "INTAKE" ? <Intake ch={ch} me={me} act={act} /> : null}
          {ch.state === "RESTATEMENT" && ch.quiz?.status === "ready" && !ch.quiz.pre_done && !skipped.pre ? (
            // Guess first, read second: the "before" half of the Understanding Score.
            <QuizPanel ch={ch} act={act} phase="pre" onSkip={() => skip("pre")} />
          ) : ch.state === "RESTATEMENT" || ch.state === "MAPPING" ? (
            <>
              <Restatements ch={ch} act={act} />
              <SteelmanExchange ch={ch} act={act} />
            </>
          ) : null}

          {ch.state === "MAP" && mapData ? (
            <>
              <MapView map={mapData} />
              <InterpretationDiff ch={ch} />
              <CruxWhatIf ch={ch} />
              <EvidenceBoard ch={ch} act={act} refresh={reload} />
              {!ch.paused ? (
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
            </>
          ) : null}

          {ch.state === "RESOLUTION" ? <Resolution ch={ch} act={act} /> : null}

          {["MAP", "OPTIONS_PENDING", "RESOLUTION", "CLOSED"].includes(ch.state) && ch.quiz?.status === "ready" && !ch.retention?.purged ? (
            <div className="mx-auto max-w-[720px] space-y-6">
              {!ch.quiz.post_done && !skipped.post && !ch.paused ? <QuizPanel ch={ch} act={act} phase="post" onSkip={() => skip("post")} /> : null}
              <ScoreCard ch={ch} />
              <SteelmanExchange ch={ch} act={act} />
            </div>
          ) : null}

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
              {mapData ? (
                <button className="mt-1 text-sm underline" onClick={() => setTab("map")}>
                  Read the Understanding Map
                </button>
              ) : null}
              {ch.agreement.items.some((i: any) => i.kind === "agreement") ? <AgreementList ch={ch} act={act} readOnly /> : null}
              {ch.closed_state === "UNDERSTOOD" && !ch.retention?.purged ? <UnderstandingRecord ch={ch} act={act} /> : null}
              {ch.closed_state !== "ABANDONED" ? <Prediction ch={ch} act={act} /> : null}
              {ch.closed_state !== "ABANDONED" ? <MindChangePrompt ch={ch} /> : null}
              <Lineage ch={ch} />
              <Retention ch={ch} act={act} />
            </Card>
          ) : null}

          {ch.map && ch.state === "CLOSED" ? <Publish ch={ch} act={act} /> : null}

          {ch.state === "INTAKE" && ch.is_creator ? (
            <div className="text-right">
              <button className="text-xs text-ink-2 underline" onClick={() => act(`/chambers/${id}/advance`, { action: "abandon" })}>
                Abandon this Chamber
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "map" && mapData ? (
        <div className="space-y-8">
          <MapView map={mapData} />
          <InterpretationDiff ch={ch} />
          <CruxWhatIf ch={ch} />
          <EvidenceBoard ch={ch} act={act} refresh={reload} />
          {ch.state !== "CLOSED" ? <Publish ch={ch} act={act} /> : null}
          <div className="text-center">
            <button className="text-sm underline" onClick={() => window.print()}>
              Print or save as PDF
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "graph" ? (
        <div className="space-y-4">
          <ArgumentGraph
            nodes={ch.graph.nodes}
            people={ch.members.map((m: Member) => ({ user_id: m.user_id, name: m.name }))}
            cruxes={ch.cruxes}
          />
          <GraphDetails ch={ch} />
        </div>
      ) : null}

      {activeTab === "timeline" ? <Timeline chamberId={ch.id} refreshKey={tick} /> : null}
    </div>
  );
}

function toMapData(ch: any): MapData {
  const nameOf = (uid: string) => ch.members.find((m: Member) => m.user_id === uid)?.name ?? "Someone";
  return {
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
  };
}

function ChamberSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading Chamber">
      <div className="h-3 w-32 rounded bg-paper-2" />
      <div className="h-9 w-2/3 rounded bg-paper-2" />
      <div className="h-4 w-1/2 rounded bg-paper-2" />
      <div className="h-6 w-80 rounded-full bg-paper-2" />
      <div className="h-40 rounded-lg bg-paper-2" />
    </div>
  );
}

/** One sentence that tells *this* person what the Chamber needs from them right now. */
function NowBanner({ ch, me, running, onGo }: { ch: any; me: Member; running: boolean; onGo?: () => void }) {
  const waitingOn = (ids: string[]) =>
    ch.members
      .filter((m: Member) => !ids.includes(m.user_id))
      .map((m: Member) => (m.is_me ? "you" : m.name))
      .join(", ");
  let title = "";
  let detail = "";
  let mine = false;
  const endorsed = ch.members.filter((m: Member) => m.intake_status === "ENDORSED").map((m: Member) => m.user_id);
  if (ch.paused) {
    title = "Paused";
    detail = ch.safety ? "Only you can see why. Take whatever time you need." : `Nothing moves until ${ch.paused_by ?? "it’s"} resumed.`;
  } else if (running) {
    title = "The Mediator is reading";
    detail = ch.run.step && ch.run.step !== "queued" ? ch.run.step : "This usually takes a few seconds.";
  } else if (ch.state === "INTAKE") {
    if (ch.members.length < 2) [title, detail] = ["Invite the people involved", "Share the invite link. A Chamber needs at least two people."];
    else if (me.intake_status !== "ENDORSED") [title, detail, mine] = ["Your turn: say where you stand", "Privately. Nobody sees your exact words.", true];
    else if (endorsed.length < ch.members.length) [title, detail] = ["Waiting for positions", `Still writing: ${waitingOn(endorsed)}.`];
    else [title, detail, mine] = ["Everyone’s ready", "Ask the Mediator to read all positions.", true];
  } else if (ch.state === "RESTATEMENT") {
    const mineR = ch.restatements.find((r: any) => r.is_mine);
    const accepted = ch.restatements.filter((r: any) => r.status === "ACCEPTED").map((r: any) => r.of_user_id);
    if (ch.quiz?.status === "ready" && !ch.quiz.pre_done) [title, detail, mine] = ["Your turn: a one-minute guess first", "Before you read how everyone’s view was explained, guess where they stand.", true];
    else if (mineR && mineR.status === "PENDING") [title, detail, mine] = ["Your turn: is this what you mean?", "Check how the Mediator explained your view to the group.", true];
    else [title, detail] = ["Waiting at the Restatement Gate", `Still checking: ${waitingOn(accepted) || "nobody"}.`];
  } else if (ch.state === "MAP") {
    [title, detail, mine] = [
      "The Understanding Map is ready",
      ch.quiz?.status === "ready" && !ch.quiz.post_done
        ? "Read it, then guess again to see your Understanding Score."
        : "Read it together, then decide: close as understood, or explore options.",
      true,
    ];
  } else if (ch.state === "RESOLUTION") {
    const ranked = ch.ranking?.ranked_user_ids ?? [];
    if (ch.options.length && !ch.ranking?.complete && !ranked.includes(me.user_id)) [title, detail, mine] = ["Your turn: rank the options", "Privately. Only the combined result is shown.", true];
    else if (ch.options.length && !ch.ranking?.complete) [title, detail] = ["Waiting for rankings", `Still ranking: ${waitingOn(ranked)}.`];
    else {
      const pending = ch.agreement.items.filter((i: any) => i.kind === "agreement" && !i.my_decision);
      if (pending.length) [title, detail, mine] = ["Your turn: review the agreement", `${pending.length} item${pending.length > 1 ? "s" : ""} need your decision.`, true];
      else [title, detail] = ["Shape the agreement", "Propose items. Each person approves each one."];
    }
  } else if (ch.state === "CLOSED") {
    [title, detail] = [
      ch.closed_state === "AGREED" ? "Agreed" : ch.closed_state === "UNDERSTOOD" ? "Understood, still disagree" : "Abandoned",
      ch.retention?.purged ? "Private content has been deleted." : "The record stays here. You can revisit it any time.",
    ];
  } else {
    [title, detail] = ["Working…", ""];
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 print:hidden ${
        mine ? "border-ink bg-white shadow-sm" : "hairline bg-white/50"
      }`}
    >
      <div>
        <span className={`label-mono ${mine ? "text-delegate" : "text-ink-2"}`}>{mine ? "Needs you" : "Now"}</span>
        <span className="block font-display text-xl leading-tight">{title}</span>
        {detail ? <span className="block text-sm text-ink-2">{detail}</span> : null}
      </div>
      {onGo ? (
        <Button variant={mine ? "primary" : "quiet"} onClick={onGo}>
          Go →
        </Button>
      ) : null}
    </div>
  );
}

/* ================================================================= members */

function Members({ ch }: { ch: any }) {
  const status = (m: Member): [string, boolean] => {
    if (ch.state === "INTAKE") return m.intake_status === "ENDORSED" ? ["✓ ready", true] : ["writing…", false];
    if (ch.state === "RESTATEMENT") {
      const r = ch.restatements.find((x: any) => x.of_user_id === m.user_id);
      return r?.status === "ACCEPTED" ? ["✓ understood", true] : ["checking…", false];
    }
    if (ch.state === "RESOLUTION" && ch.options.length && !ch.ranking?.complete)
      return ch.ranking?.ranked_user_ids.includes(m.user_id) ? ["✓ ranked", true] : ["ranking…", false];
    return ["", false];
  };
  return (
    <ul className="flex flex-wrap gap-2" aria-label="People in this Chamber">
      {ch.members.map((m: Member) => {
        const [label, done] = status(m);
        return (
          <li key={m.user_id} className="flex items-center gap-2 rounded-full border hairline bg-white/70 py-1 pl-1 pr-3">
            <HumanAvatar name={m.name} size={26} />
            {m.delegate ? <Glyph seed={m.delegate.glyph_seed} size={20} /> : null}
            <span className="text-sm">
              {m.name}
              {m.is_me ? <span className="text-ink-2"> (you)</span> : null}
            </span>
            {label ? <span className={`label-mono ${done ? "text-agree" : "text-ink-2"}`}>{label}</span> : null}
          </li>
        );
      })}
    </ul>
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
      <div className="space-y-6">
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
      <PreRound
        ch={ch}
        act={act}
        onUse={(t) => {
          setText(t);
          setEditing(true);
        }}
      />
      </div>

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

/* ================================================================= Delegate pre-round */

function PreRound({ ch, act, onUse }: { ch: any; act: (p: string, b?: unknown) => Promise<any>; onUse: (t: string) => void }) {
  const pr = ch.preround;
  const participants = ch.members.filter((m: Member) => pr.participant_ids.includes(m.user_id));
  const running = ch.run?.status === "RUNNING" && ch.run.kind?.startsWith("preround");
  if (pr.phase === "none" && !pr.can_start && !running) {
    return participants.length < 2 && ch.members.length >= 2 ? (
      <p className="text-xs text-ink-2">A Delegate pre-round becomes available when at least two people here have an active Delegate.</p>
    ) : null;
  }
  const openings = pr.turns.filter((t: any) => t.kind === "opening");
  const replies = pr.turns.filter((t: any) => t.kind === "reply");
  const myReleased = pr.turns.filter((t: any) => t.is_mine && t.status === "RELEASED");

  return (
    <Card>
      <SectionTitle kicker="Optional · Delegates go first">Delegate pre-round</SectionTitle>
      <p className="text-sm text-ink-2">
        Your Delegates sketch each side from what you’ve endorsed, then reply to each other once. You review and edit your own Delegate’s
        turn before anyone sees it, and turns are revealed to everyone at the same time.
      </p>
      {pr.phase === "none" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={ch.paused || running} onClick={() => act(`/chambers/${ch.id}/preround/start`)}>
            Start a pre-round
          </Button>
          <span className="text-xs text-ink-2">With: {participants.map((m: Member) => m.name).join(", ")}</span>
        </div>
      ) : null}

      {openings.length ? <TurnList title="Openings" turns={openings} pending={pr.pending.opening} ch={ch} act={act} /> : null}
      {replies.length ? <TurnList title="Replies" turns={replies} pending={pr.pending.reply} ch={ch} act={act} /> : null}

      {pr.phase === "done" && myReleased.length ? (
        <div className="mt-4 border-t hairline pt-3">
          <Button variant="quiet" onClick={() => onUse(myReleased.map((t: any) => t.text).join("\n\n"))}>
            Use my side as a starting point for my position
          </Button>
          <p className="mt-1 text-xs text-ink-2">It goes into your private composer as text you can rewrite in your own words before endorsing.</p>
        </div>
      ) : null}
    </Card>
  );
}

function TurnList({ title, turns, pending, ch, act }: { title: string; turns: any[]; pending: string[]; ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  return (
    <div className="mt-5">
      <div className="label-mono text-ink-2">{title}</div>
      {pending.length ? <p className="mt-1 text-xs text-ink-2">Waiting for {pending.join(", ")} to review their Delegate’s turn. Others’ turns appear when everyone has.</p> : null}
      <div className="mt-2 space-y-3">
        {turns.map((t) => (t.is_mine && t.status === "DRAFT" ? <MyDraftTurn key={t.id} t={t} ch={ch} act={act} /> : <TurnView key={t.id} t={t} />))}
      </div>
    </div>
  );
}

function TurnView({ t }: { t: any }) {
  return (
    <div className="rounded-md border-l-2 border-l-delegate bg-delegate-tint/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {t.delegate ? <DelegateBadge name={t.delegate.name} ownerName={t.owner_name} seed={t.delegate.glyph_seed} /> : null}
        {t.status === "WITHDRAWN" ? <span className="label-mono text-ink-2">withdrawn · not shown to others</span> : <EpistemicTag status="ENDORSED" />}
      </div>
      {t.status !== "WITHDRAWN" ? (
        <>
          <p className="font-body mt-2">{t.text}</p>
          <p className="mt-1 text-xs text-ink-2">
            {t.authored_by === "human" ? `Rewritten and released by ${t.owner_name}` : `Reviewed and released by ${t.owner_name}`}
          </p>
        </>
      ) : null}
    </div>
  );
}

function MyDraftTurn({ t, ch, act }: { t: any; ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const [text, setText] = useState(t.text);
  return (
    <div className="rounded-md border border-delegate/40 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        {t.delegate ? <DelegateBadge name={t.delegate.name} ownerName={t.owner_name} seed={t.delegate.glyph_seed} /> : null}
        <EpistemicTag status="DRAFT" />
        <span className="text-xs text-ink-2">Only you can see this</span>
      </div>
      <TextArea rows={4} className="mt-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Your Delegate didn’t know enough to draft this. Write it, or withdraw." />
      {t.unknowns?.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-delegate">
          {t.unknowns.map((u: string, i: number) => (
            <li key={i}>• Doesn’t know: {u}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button disabled={text.trim().length < 3 || ch.paused} onClick={() => act(`/preround-turns/${t.id}/release`, { text })}>
          Release to the group
        </Button>
        <Button variant="ghost" disabled={ch.paused} onClick={() => act(`/preround-turns/${t.id}/withdraw`)}>
          Withdraw
        </Button>
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

/** Same events, different meanings: each person's observations next to their interpretations.
 *  Only ENDORSED claims (verbatim from what they endorsed) are attributed here (invariant 3). */
function InterpretationDiff({ ch }: { ch: any }) {
  const claims = ch.graph.nodes.filter((n: any) => n.kind === "CLAIM" && n.epistemic_status === "ENDORSED");
  if (!claims.some((n: any) => n.claim_type === "INTERPRETATION")) return null;
  const people = ch.members.filter((m: Member) => claims.some((n: any) => n.holder_id === m.user_id));
  return (
    <section className="mx-auto max-w-[720px]">
      <h2 className="label-mono border-b hairline pb-2 text-ink-2">Interpretation diff</h2>
      <p className="mt-2 text-sm text-ink-2">
        What each person describes as happening, next to what they take it to mean. Disagreements about meaning often dissolve once
        the observations are separated out.
      </p>
      <div className={`mt-4 grid gap-4 ${people.length > 1 ? "md:grid-cols-2" : ""}`}>
        {people.map((m: Member) => {
          const mine = claims.filter((n: any) => n.holder_id === m.user_id);
          const obs = mine.filter((n: any) => n.claim_type === "FACT");
          const interp = mine.filter((n: any) => n.claim_type === "INTERPRETATION");
          return (
            <div key={m.user_id} className="rounded-lg border hairline bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg">{m.name}</span>
                <EpistemicTag status="ENDORSED" />
              </div>
              <div className="label-mono mt-3 text-ink-2">Observes</div>
              <ul className="font-body mt-1 space-y-1">
                {obs.length ? obs.map((n: any) => <li key={n.id}>{n.text}</li>) : <li className="text-sm italic text-ink-2">No plain observations stated.</li>}
              </ul>
              <div className="label-mono mt-3 text-engine">Takes it to mean</div>
              <ul className="font-body mt-1 space-y-1">
                {interp.length ? (
                  interp.map((n: any) => (
                    <li key={n.id} className="border-l-2 border-engine/50 pl-2">
                      {n.text}
                    </li>
                  ))
                ) : (
                  <li className="text-sm italic text-ink-2">No interpretations stated.</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

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
      {ch.options.length ? <Ranking ch={ch} act={act} /> : null}

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

/** Private ranking of the Mediator's options. Only the combined (Borda) result is ever shown. */
function Ranking({ ch, act }: { ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const r = ch.ranking;
  const [order, setOrder] = useState<number[]>(r.mine ?? ch.options.map((_: any, i: number) => i));
  const move = (pos: number, d: -1 | 1) => {
    const next = [...order];
    const j = pos + d;
    if (j < 0 || j >= next.length) return;
    [next[pos], next[j]] = [next[j], next[pos]];
    setOrder(next);
  };
  const others = ch.members.filter((m: Member) => !r.ranked_user_ids.includes(m.user_id)).map((m: Member) => (m.is_me ? "you" : m.name));

  if (r.complete) {
    const top = r.results[0];
    return (
      <Card>
        <SectionTitle kicker="Everyone has ranked · individual rankings stay private">How the options landed</SectionTitle>
        <ol className="space-y-4">
          {r.results.map((res: any, i: number) => {
            const o = ch.options[res.index];
            const pct = res.max_points ? Math.round((res.points / res.max_points) * 100) : 0;
            return (
              <li key={res.index}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg">
                    {i + 1}. {o.title}
                  </span>
                  <span className="label-mono shrink-0 text-ink-2">
                    {res.first_choices} first · {res.last_choices} last
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-paper-2" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${o.title}: ${pct}% of possible support`}>
                  <div className="h-2 rounded-full bg-ink" style={{ width: `${pct}%` }} />
                </div>
                <p className="prose-body mt-1 text-sm text-ink-2">{o.description}</p>
                <Button
                  variant={res === top ? "primary" : "quiet"}
                  className="mt-2"
                  disabled={ch.paused}
                  onClick={() => act(`/chambers/${ch.id}/agreement/items`, { text: `${o.title}: ${o.description}`, from_option: true })}
                >
                  Propose as an agreement item
                </Button>
              </li>
            );
          })}
        </ol>
        {top && top.last_choices > 0 ? (
          <p className="mt-4 text-sm text-engine">
            Note: the top option is someone’s last choice. An agreement everyone can live with may beat the highest score.
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle kicker="Private · only the combined result is shown">Rank the Mediator’s options</SectionTitle>
      <p className="mb-3 text-sm text-ink-2">Put the option you could best live with first. You can change your ranking until everyone has ranked.</p>
      <ol className="space-y-2">
        {order.map((oi, pos) => {
          const o = ch.options[oi];
          return (
            <li key={oi} className="flex items-start gap-3 rounded-md border hairline bg-white p-3">
              <span className="font-display w-6 text-xl text-ink-2">{pos + 1}</span>
              <div className="flex-1">
                <MediatorBadge />
                <div className="mt-1 font-display text-lg">{o.title}</div>
                <p className="prose-body text-sm">{o.description}</p>
                <p className="mt-1 text-xs text-ink-2">Trade-offs: {o.trade_offs}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button className="rounded border hairline px-2 text-sm disabled:opacity-30" disabled={pos === 0} onClick={() => move(pos, -1)} aria-label={`Move ${o.title} up`}>
                  ↑
                </button>
                <button className="rounded border hairline px-2 text-sm disabled:opacity-30" disabled={pos === order.length - 1} onClick={() => move(pos, 1)} aria-label={`Move ${o.title} down`}>
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button disabled={ch.paused} onClick={() => act(`/chambers/${ch.id}/ranking`, { order })}>
          {r.mine ? "Update my ranking" : "Submit my ranking"}
        </Button>
        <span className="text-sm text-ink-2">{others.length ? `Waiting for: ${others.join(", ")}` : ""}</span>
      </div>
    </Card>
  );
}

function AgreementList({
  ch,
  act,
  readOnly,
  kind = "agreement",
}: {
  ch: any;
  act: (p: string, b?: unknown) => Promise<any>;
  readOnly?: boolean;
  kind?: "agreement" | "understanding";
}) {
  const items = ch.agreement.items.filter((i: any) => i.kind === kind);
  if (!items.length) return <p className="text-sm text-ink-2">No items proposed yet.</p>;
  return (
    <ul className="mt-2 space-y-3">
      {items.map((it: any) => (
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

/* ================================================================= agree-to-disagree & lineage */

function UnderstandingRecord({ ch, act }: { ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const types = Array.from(new Set((ch.map?.differences ?? []).map((d: any) => d.type.toLowerCase())));
  const q = (ch.map?.headline ?? ch.question).trim();
  const starter = `We understand each other’s views on “${q}”${/[?.!]$/.test(q) ? "" : "."} We still differ on ${
    types.length ? types.join(" and ") + " grounds" : "this"
  }. We’ll handle it by: `;
  const [text, setText] = useState(starter);
  const has = ch.agreement.items.some((i: any) => i.kind === "understanding");
  return (
    <div className="mt-5 border-t hairline pt-4">
      <div className="label-mono text-ink-2">Agree-to-disagree record</div>
      <p className="mt-1 text-sm text-ink-2">
        A record you all sign: you understand each other, you still differ, and here’s how you’ll live with it. Each person approves it
        separately; nothing is pre-approved.
      </p>
      {has ? <AgreementList ch={ch} act={act} kind="understanding" /> : null}
      <TextArea rows={3} className="mt-3" aria-label="Agree-to-disagree record" value={text} onChange={(e) => setText(e.target.value)} />
      <Button
        className="mt-2"
        variant="quiet"
        disabled={text.trim().length < starter.length + 3 || ch.paused}
        onClick={async () => {
          await act(`/chambers/${ch.id}/agreement/items`, { text, kind: "understanding" });
          setText(starter);
        }}
      >
        Propose this record
      </Button>
    </div>
  );
}

function Lineage({ ch }: { ch: any }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const revisits = ch.lineage?.revisits ?? [];
  return (
    <div className="mt-5 border-t hairline pt-4">
      <div className="label-mono text-ink-2">Things change</div>
      {revisits.length ? (
        <p className="mt-1 text-sm">
          Revisited in{" "}
          {revisits.map((r: any, i: number) => (
            <span key={r.id}>
              {i ? ", " : ""}
              <Link href={`/chambers/${r.id}`} className="underline">
                {r.title}
              </Link>
            </span>
          ))}
          .
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={async () => {
            setError(null);
            try {
              const v = await api(`/chambers/${ch.id}/revisit`, { body: {} });
              router.push(`/chambers/${v.id}`);
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          Revisit this with the same people
        </Button>
        <span className="text-xs text-ink-2">Starts a new Chamber on the same question, linked to this outcome.</span>
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

/** Decision Replay: seal a prediction at close; it's revealed and reviewed when the Chamber is revisited. */
function Prediction({ ch, act }: { ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const pr = ch.predictions;
  const [text, setText] = useState(pr?.mine?.text ?? "");
  const [conf, setConf] = useState<number>(pr?.mine?.confidence ?? 60);
  const [editing, setEditing] = useState(!pr?.mine);
  if (!pr || ch.retention?.purged) return null;
  if (!pr.sealed) {
    return (
      <div className="mt-5 border-t hairline pt-4">
        <div className="label-mono text-ink-2">Decision Replay · unsealed</div>
        <PredictionList preds={pr.all ?? []} />
        {pr.mine && !pr.mine.verdict ? <ReviewPrediction chamberId={ch.id} act={act} /> : null}
      </div>
    );
  }
  return (
    <div className="mt-5 border-t hairline pt-4">
      <div className="label-mono text-ink-2">Decision Replay · sealed until you revisit</div>
      <p className="mt-1 text-sm text-ink-2">
        What do you expect will actually happen? Nobody sees predictions until this Chamber is revisited; then you compare notes.
        {pr.count ? ` ${pr.count} sealed so far.` : ""}
      </p>
      {editing ? (
        <>
          <TextArea rows={2} className="mt-2" aria-label="Your prediction" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. “We’ll stick to the rota for about a month, then slip.”" />
          <label className="mt-2 flex items-center gap-3 text-sm">
            How sure? <input type="range" min={0} max={100} step={5} value={conf} onChange={(e) => setConf(Number(e.target.value))} className="flex-1 accent-[#1A1A1A]" aria-label="Confidence" />
            <span className="w-10 font-mono text-xs">{conf}%</span>
          </label>
          <Button
            className="mt-2"
            variant="quiet"
            disabled={text.trim().length < 5}
            onClick={async () => {
              await act(`/chambers/${ch.id}/prediction`, { text, confidence: conf });
              setEditing(false);
            }}
          >
            Seal my prediction
          </Button>
        </>
      ) : (
        <p className="mt-2 text-sm">
          🔒 Your sealed prediction: <em>“{pr.mine?.text}”</em> ({pr.mine?.confidence}% sure){" "}
          <button className="text-xs underline" onClick={() => setEditing(true)}>
            change
          </button>
        </p>
      )}
    </div>
  );
}

function PredictionList({ preds }: { preds: any[] }) {
  if (!preds.length) return <p className="mt-1 text-sm text-ink-2">Nobody sealed a prediction.</p>;
  const V: Record<string, string> = { right: "✓ turned out right", partly: "≈ partly right", wrong: "✕ turned out wrong" };
  return (
    <ul className="mt-2 space-y-2">
      {preds.map((p) => (
        <li key={p.id} className="text-sm">
          <strong>{p.name}</strong> predicted <em>“{p.text}”</em> <span className="text-ink-2">({p.confidence}% sure)</span>
          {p.verdict ? (
            <span className="ml-2 label-mono text-ink-2">
              {V[p.verdict]}
              {p.review_note ? `: ${p.review_note}` : ""}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ReviewPrediction({ chamberId, act }: { chamberId: string; act: (p: string, b?: unknown) => Promise<any> }) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 rounded-md bg-paper-2 p-3 text-sm">
      Looking back, how did your prediction hold up?
      <TextArea rows={1} className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
      <div className="mt-2 flex flex-wrap gap-2">
        {[
          ["right", "Turned out right"],
          ["partly", "Partly"],
          ["wrong", "Turned out wrong"],
        ].map(([v, l]) => (
          <Button key={v} variant="quiet" onClick={() => act(`/chambers/${chamberId}/prediction/review`, { verdict: v, note })}>
            {l}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ParentContext({ p, act }: { p: any; act: (p: string, b?: unknown) => Promise<any> }) {
  return (
    <Card className="border-delegate/40 bg-delegate-tint/30">
      <div className="label-mono text-ink-2">Revisiting</div>
      <p className="mt-1">
        <Link href={`/chambers/${p.id}`} className="font-display text-xl underline">
          {p.title}
        </Link>{" "}
        <span className="text-sm text-ink-2">
          closed {p.closed_at ? new Date(p.closed_at).toLocaleDateString() : ""} as {p.closed_state?.toLowerCase()}
        </span>
      </p>
      {p.approved.length ? (
        <ul className="mt-2 space-y-1 text-sm">
          {p.approved.map((a: any, i: number) => (
            <li key={i}>
              <span className="label-mono mr-2 text-agree">{a.kind === "understanding" ? "agreed to disagree" : "agreed"}</span>
              {a.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-2">Nothing was formally agreed last time.</p>
      )}
      {p.predictions && !p.predictions.sealed && p.predictions.all?.length ? (
        <div className="mt-3 border-t hairline pt-3">
          <div className="label-mono text-ink-2">Decision Replay: what you each expected</div>
          <PredictionList preds={p.predictions.all} />
          {p.predictions.mine && !p.predictions.mine.verdict ? <ReviewPrediction chamberId={p.id} act={act} /> : null}
        </div>
      ) : null}
      <p className="mt-2 text-xs text-ink-2">Positions start fresh: what you think now may differ from then, and that’s the point.</p>
    </Card>
  );
}

/* ================================================================= retention */

function Retention({ ch, act }: { ch: any; act: (p: string, b?: unknown) => Promise<any> }) {
  const r = ch.retention;
  if (!r?.retain_until) return null;
  return (
    <div className="mt-4 border-t hairline pt-3 text-sm text-ink-2">
      {r.purged ? (
        <p>The private content of this Chamber has been deleted under the retention policy. Agreements and the record are kept.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Positions, restatements and the Map will be deleted on <strong className="text-ink">{new Date(r.retain_until).toLocaleDateString()}</strong>.
            Agreements and the record are kept.
          </span>
          <Button variant="ghost" onClick={() => act(`/chambers/${ch.id}/retention/extend`)}>
            Keep 90 more days
          </Button>
        </div>
      )}
    </div>
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
