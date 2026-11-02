"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api, useMe, usePoll } from "@/lib/api";
import { Button, Card, DelegateBadge, EpistemicTag, ErrorNote, SectionTitle, TextArea } from "@/components/ui";
import { RecordSummary } from "@/components/PositionRecord";

export default function DelegateProfile() {
  const { handle } = useParams<{ handle: string }>();
  const router = useRouter();
  const { me } = useMe();
  const { data: d, error } = usePoll<any>(`/delegates/${handle}`, 0);
  const [topic, setTopic] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (error) return <ErrorNote error={error.message} />;
  if (!d) return null;
  const isMine = me?.delegate_handle === d.handle;
  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <div>
        <DelegateBadge name={d.name} ownerName={d.owner_name} handle={d.handle} seed={d.glyph_seed} />
        <p className="mt-2 text-sm text-ink-2">Reasoning style: {d.methodology}. Shows only positions its owner marked public.</p>
      </div>
      <Card className="space-y-3">
        {d.public_positions.map((p: any) => (
          <div key={p.id}>
            <EpistemicTag status="ENDORSED" /> <span className="label-mono text-ink-2">{p.stance}</span>
            <p className="font-body">{p.statement}</p>
          </div>
        ))}
        {!d.public_positions.length ? <p className="text-sm text-ink-2">No public positions.</p> : null}
      </Card>
      {d.record ? (
        <Card>
          <SectionTitle kicker="Position Record">How {d.owner_name} handles disagreement</SectionTitle>
          <RecordSummary r={d.record} publicView />
        </Card>
      ) : null}
      {d.allow_rehearsal && me && !isMine ? (
        <Card>
          <SectionTitle kicker="Rehearsal Room">Practise a hard conversation with {d.owner_name}</SectionTitle>
          <p className="text-sm text-ink-2">
            {d.owner_name} has allowed rehearsals. Their Delegate answers only from their public positions and says plainly when it
            doesn’t know. {d.owner_name} sees that rehearsals happened, not what you said. It’s practice, not the real person.
          </p>
          <TextArea rows={2} className="mt-3" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What do you want to talk to them about?" />
          <Button
            className="mt-2"
            disabled={topic.trim().length < 5}
            onClick={async () => {
              setErr(null);
              try {
                const s = await api("/rehearsals", { body: { handle: d.handle, topic } });
                router.push(`/spar/${s.id}`);
              } catch (e: any) {
                setErr(e.message);
              }
            }}
          >
            Start rehearsing
          </Button>
          <ErrorNote error={err} />
        </Card>
      ) : null}
    </div>
  );
}
