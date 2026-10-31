"use client";

import { useParams } from "next/navigation";
import { usePoll } from "@/lib/api";
import { ErrorNote } from "@/components/ui";
import { MapView } from "@/components/MapView";

export default function PublicMap() {
  const { slug } = useParams<{ slug: string }>();
  const { data: m, error } = usePoll<any>(`/public/maps/${slug}`, 0);
  if (error) return <ErrorNote error={error.message} />;
  if (!m) return <p className="text-ink-2">Loading…</p>;
  return (
    <MapView
      map={{
        headline: m.headline,
        summary: m.summary,
        stands: m.where_you_stand,
        shared: m.shared,
        differences: m.differences,
        cruxes: m.cruxes,
        open_questions: m.open_questions,
      }}
      footer={
        <p className="mt-4 text-xs text-ink-2">
          Published with the consent of all {m.participants} participants{m.anonymized ? "; names replaced" : ""}. Outcome:{" "}
          {m.closed_state ? m.closed_state.toLowerCase() : "still open"}.
        </p>
      }
    />
  );
}
