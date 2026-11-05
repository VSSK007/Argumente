"use client";

import { useState } from "react";
import { api, usePoll } from "@/lib/api";
import { Button, Card, EpistemicTag, SectionTitle, TextArea } from "@/components/ui";

/** "Your Delegate learned N things. Keep?": suggestions are never used until the owner keeps them. */
export function LearnedReview({ compact = false, onChange }: { compact?: boolean; onChange?: () => void }) {
  const { data, reload } = usePoll<any[]>("/delegates/me/candidates", 0);
  const done = () => {
    reload();
    onChange?.();
  };
  if (!data || !data.length) return null;
  const chambers = Array.from(new Set(data.map((c) => c.source.replace("CHAMBER:", ""))));
  return (
    <section>
      <SectionTitle kicker="Your Delegate">
        Learned {data.length} thing{data.length === 1 ? "" : "s"} from {chambers.map((c) => `“${c}”`).join(", ")}. Keep?
      </SectionTitle>
      <p className="mb-3 text-sm text-ink-2">
        Suggestions come only from what you endorsed in that Chamber. Your Delegate won’t use any of them unless you keep them.
      </p>
      <div className={`grid gap-3 ${compact ? "md:grid-cols-2" : ""}`}>
        {data.map((c) => (
          <Candidate key={c.id} c={c} onDone={done} />
        ))}
      </div>
    </section>
  );
}

function Candidate({ c, onDone }: { c: any; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.statement);
  async function keep(scope: "PRIVATE" | "PUBLIC") {
    await api(`/delegates/me/candidates/${c.id}/keep`, { body: { statement: text, scope_type: scope } });
    onDone();
  }
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <EpistemicTag status="INFERRED" />
        <span className="label-mono text-ink-2">suggestion</span>
      </div>
      {editing ? <TextArea rows={2} className="mt-2" value={text} onChange={(e) => setText(e.target.value)} /> : <p className="font-body mt-2">{text}</p>}
      {c.quote ? <p className="mt-1 text-xs text-ink-2">From your words: “{c.quote}”</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => keep("PRIVATE")}>Keep</Button>
        <Button variant="quiet" onClick={() => keep("PUBLIC")} title="Also shown on your Delegate's public profile">
          Keep as public
        </Button>
        {!editing ? (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
        <Button
          variant="ghost"
          onClick={async () => {
            await api(`/delegates/me/candidates/${c.id}/discard`, { body: {} });
            onDone();
          }}
        >
          Discard
        </Button>
      </div>
    </Card>
  );
}
