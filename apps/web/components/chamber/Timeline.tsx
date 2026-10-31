"use client";

import { usePoll } from "@/lib/api";

/** Debate timeline: the whole Chamber history grouped into protocol stages. */

export const EVENT_LABEL: Record<string, string> = {
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
  "preround.started": "started a Delegate pre-round",
  "preround.openings.drafted": "Delegates drafted openings",
  "preround.replies.drafted": "Delegates drafted replies",
  "preround.opening.released": "released their Delegate's opening",
  "preround.reply.released": "released their Delegate's reply",
  "preround.opening.withdrawn": "withdrew their Delegate's opening",
  "preround.reply.withdrawn": "withdrew their Delegate's reply",
  "preround.openings.revealed": "Openings revealed to everyone",
  "preround.replies.revealed": "Replies revealed to everyone",
  "retention.extended": "extended how long this Chamber is kept",
  "chamber.purged": "Private content deleted (retention)",
  "chamber.revisited": "started a revisit of this Chamber",
  "ranking.submitted": "ranked the options privately",
  "ranking.revealed": "Everyone ranked; results revealed",
  "prediction.recorded": "sealed a prediction",
  "prediction.reviewed": "looked back at their prediction",
};

const STAGE_OF: Record<string, string> = {
  INTAKE: "Positions",
  ANALYZING: "Mediator reading",
  RESTATEMENT: "Restatement gate",
  MAPPING: "Restatement gate",
  MAP: "Understanding Map",
  OPTIONS_PENDING: "Options",
  RESOLUTION: "Options & agreement",
  CLOSED: "Closed",
};

const MILESTONES = new Set(["gate.passed", "map.generated", "chamber.closed", "ranking.revealed", "preround.openings.revealed", "publication.published"]);
const QUIET = new Set(["engine.run.started", "engine.run.completed", "state.changed"]);

export function Timeline({ chamberId, refreshKey }: { chamberId: string; refreshKey: number }) {
  const { data } = usePoll<any[]>(`/chambers/${chamberId}/events?k=${refreshKey}`, 0);
  if (!data) return <p className="text-sm text-ink-2">Loading the record…</p>;

  // Split into stages at each state change
  const groups: { stage: string; events: any[] }[] = [{ stage: "Positions", events: [] }];
  for (const e of data) {
    if (e.type === "state.changed" && e.payload?.state) {
      const stage = STAGE_OF[e.payload.state] ?? e.payload.state;
      if (groups[groups.length - 1].stage !== stage) groups.push({ stage, events: [] });
      continue;
    }
    if (e.type === "chamber.closed") groups.push({ stage: "Closed", events: [] });
    groups[groups.length - 1].events.push(e);
  }

  return (
    <ol className="relative mx-auto max-w-[720px] border-l-2 border-rule pl-6">
      {groups
        .filter((g) => g.events.length)
        .map((g, gi) => (
          <li key={gi} className="mb-8">
            <span className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-ink bg-paper" aria-hidden />
            <h3 className="label-mono text-ink">{g.stage}</h3>
            <ul className="mt-2 space-y-1.5">
              {g.events.map((e) => (
                <li key={e.id} className={`flex gap-3 text-sm ${QUIET.has(e.type) ? "text-ink-2" : ""}`}>
                  <time className="w-16 shrink-0 font-mono text-xs leading-5 text-ink-2" dateTime={e.at}>
                    {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </time>
                  <span className={MILESTONES.has(e.type) ? "font-semibold" : ""}>
                    {e.actor_type === "engine" ? <span className="text-engine">§ </span> : e.actor_type === "delegate" ? <span className="text-delegate">◆ </span> : null}
                    {e.actor_name ? <strong className="font-medium">{e.actor_name} </strong> : null}
                    {EVENT_LABEL[e.type] ?? e.type}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
    </ol>
  );
}
