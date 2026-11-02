"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useMe, usePoll } from "@/lib/api";
import { Button, Card, ErrorNote, SectionTitle, TextArea } from "@/components/ui";

const ACTION_LABEL: Record<string, string> = {
  hide_statement: "Hide statement",
  restore_statement: "Restore statement",
  close_topic: "Close topic",
  unpublish_map: "Unpublish Map",
  suspend_delegate: "Suspend Delegate",
  restore_delegate: "Restore Delegate",
  dismiss: "Dismiss",
};

export default function Admin() {
  const { me } = useMe();
  const [status, setStatus] = useState("OPEN");
  const { data, reload, error } = usePoll<any[]>(me?.is_admin ? `/admin/reports?status=${status}` : null, 0);
  const { data: audit, reload: reloadAudit } = usePoll<any[]>(me?.is_admin ? "/admin/audit" : null, 0);
  if (me && !me.is_admin) return <p className="text-ink-2">Moderators only. Moderators are set with the ADMIN_EMAILS setting on the API.</p>;
  return (
    <div className="space-y-10">
      <div>
        <div className="label-mono text-ink-2">Moderation</div>
        <h1 className="font-display text-4xl">Reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          You see public content only. Private Chambers and Spar sessions are never opened to moderators; reports about them show the reason
          alone. Every action is recorded in the audit log. Statements reported by three different people are hidden automatically until reviewed.
        </p>
      </div>
      <div className="flex gap-2" role="tablist">
        {["OPEN", "RESOLVED", "DISMISSED", "ALL"].map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-sm ${status === s ? "bg-ink text-paper" : "border hairline"}`}>
            {s.toLowerCase()}
          </button>
        ))}
      </div>
      <ErrorNote error={error?.message ?? null} />
      <div className="space-y-3">
        {(data ?? []).map((r) => (
          <ReportCard
            key={r.id}
            r={r}
            onDone={() => {
              reload();
              reloadAudit();
            }}
          />
        ))}
        {data && !data.length ? <p className="text-ink-2">Nothing here.</p> : null}
      </div>
      <section>
        <SectionTitle kicker="Accountability">Audit log</SectionTitle>
        <ul className="divide-y hairline border-y hairline text-sm">
          {(audit ?? []).map((a, i) => (
            <li key={i} className="flex flex-wrap gap-3 py-2">
              <time className="w-40 font-mono text-xs text-ink-2">{new Date(a.at).toLocaleString()}</time>
              <span className="w-40 truncate">{a.actor}</span>
              <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
              <span className="text-ink-2">
                {a.target_type} {a.target_id}
                {a.note ? `: ${a.note}` : ""}
              </span>
            </li>
          ))}
          {audit && !audit.length ? <li className="py-2 text-ink-2">No actions yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}

function ReportCard({ r, onDone }: { r: any; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label-mono text-ink-2">
          {r.target_type} · {r.reports_on_target} report{r.reports_on_target === 1 ? "" : "s"} · {new Date(r.created_at).toLocaleString()}
        </span>
        <span className={`label-mono ${r.status === "OPEN" ? "text-crux" : "text-ink-2"}`}>{r.status.toLowerCase()}</span>
      </div>
      <p className="prose-body mt-2">{r.target.text}</p>
      {r.target.context ? <p className="text-sm text-ink-2">In: {r.target.context}</p> : null}
      <p className="mt-1 text-sm">
        <strong>Reason:</strong> {r.reason} <span className="text-ink-2">(reported by {r.reporter})</span>
        {r.target.status ? <span className="ml-2 label-mono text-ink-2">current: {r.target.status.toLowerCase()}</span> : null}
        {r.target.link ? (
          <Link href={r.target.link} className="ml-2 underline">
            view
          </Link>
        ) : null}
      </p>
      {r.status === "OPEN" ? (
        <>
          <TextArea rows={1} className="mt-3" aria-label="Note for the audit log" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the audit log (optional)" />
          <div className="mt-2 flex flex-wrap gap-2">
            {r.actions.map((a: string) => (
              <Button
                key={a}
                variant={a === "dismiss" ? "ghost" : a.startsWith("restore") ? "secondary" : "danger"}
                onClick={async () => {
                  setError(null);
                  try {
                    await api(`/admin/reports/${r.id}/resolve`, { body: { action: a, note: note || null } });
                    onDone();
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              >
                {ACTION_LABEL[a] ?? a}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-2">{r.resolution}</p>
      )}
      <ErrorNote error={error} />
    </Card>
  );
}
