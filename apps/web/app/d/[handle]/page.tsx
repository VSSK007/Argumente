"use client";

import { useParams } from "next/navigation";
import { usePoll } from "@/lib/api";
import { Card, DelegateBadge, EpistemicTag, ErrorNote } from "@/components/ui";

export default function DelegateProfile() {
  const { handle } = useParams<{ handle: string }>();
  const { data: d, error } = usePoll<any>(`/delegates/${handle}`, 0);
  if (error) return <ErrorNote error={error.message} />;
  if (!d) return null;
  return (
    <div className="mx-auto max-w-[720px]">
      <DelegateBadge name={d.name} ownerName={d.owner_name} handle={d.handle} seed={d.glyph_seed} />
      <p className="mt-2 text-sm text-ink-2">Reasoning style: {d.methodology}. Shows only positions its owner marked public.</p>
      <Card className="mt-6 space-y-3">
        {d.public_positions.map((p: any) => (
          <div key={p.id}>
            <EpistemicTag status="ENDORSED" /> <span className="label-mono text-ink-2">{p.stance}</span>
            <p className="font-body">{p.statement}</p>
          </div>
        ))}
        {!d.public_positions.length ? <p className="text-sm text-ink-2">No public positions.</p> : null}
      </Card>
    </div>
  );
}
