"use client";

import { useState } from "react";
import { api, usePoll } from "@/lib/api";
import { Button, Card, SectionTitle, TextArea } from "@/components/ui";

type Record = {
  mind_changes: { id: string; text: string; is_public: boolean; at: string }[];
  steelmen_accepted: number;
  steelmen_rated: number;
  calibration: { right: number; partly: number; wrong: number };
};

/** Shared rendering for the owner's page and the public profile. */
export function RecordSummary({ r, publicView = false }: { r: Record; publicView?: boolean }) {
  const cal = r.calibration;
  const reviewed = cal.right + cal.partly + cal.wrong;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-3 text-center">
        <Stat n={r.mind_changes.length} label={publicView ? "public changes of mind" : "changes of mind"} />
        <Stat n={r.steelmen_accepted} label={`steelmen accepted${r.steelmen_rated ? ` of ${r.steelmen_rated}` : ""}`} />
        <Stat n={reviewed ? `${cal.right}·${cal.partly}·${cal.wrong}` : "–"} label="predictions right · partly · wrong" />
      </dl>
      {r.mind_changes.length ? (
        <ol className="relative border-l-2 border-rule pl-5">
          {r.mind_changes.map((m) => (
            <li key={m.id} className="mb-4">
              <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-agree bg-paper" aria-hidden />
              <time className="label-mono text-ink-2" dateTime={m.at}>
                {new Date(m.at).toLocaleDateString()}
              </time>
              <p className="font-body">{m.text}</p>
              {!publicView ? <span className="text-xs text-ink-2">{m.is_public ? "Public" : "Private"}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-2">{publicView ? "No public changes of mind yet." : "Nothing yet. When a conversation shifts your view, note it here."}</p>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-md border hairline bg-white/70 p-3">
      <dt className="font-display text-2xl">{n}</dt>
      <dd className="text-xs text-ink-2">{label}</dd>
    </div>
  );
}

/** Owner view: add, publish/unpublish and delete entries; opt the whole record into the public profile. */
export function MyPositionRecord({ delegate, onDelegate }: { delegate: any | null; onDelegate: (d: any) => void }) {
  const { data: r, setData } = usePoll<Record>("/me/record", 0);
  const [text, setText] = useState("");
  if (!r) return null;
  return (
    <section>
      <SectionTitle kicker="Position Record">Where you’ve changed your mind</SectionTitle>
      <p className="mb-4 text-sm text-ink-2">
        Most places reward never budging. Here, changing your mind for a good reason, steelmanning people fairly and predicting honestly
        are what count.
      </p>
      <Card className="space-y-5">
        <RecordSummary r={r} />
        {r.mind_changes.length ? (
          <ul className="space-y-1 text-xs">
            {r.mind_changes.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3">
                <span className="max-w-md truncate text-ink-2">{m.text}</span>
                <button className="underline" onClick={async () => setData(await api(`/me/mind-changes/${m.id}`, { method: "PATCH", body: { is_public: !m.is_public } }))}>
                  make {m.is_public ? "private" : "public"}
                </button>
                <button className="text-crux underline" onClick={async () => setData(await api(`/me/mind-changes/${m.id}`, { method: "DELETE" }))}>
                  delete
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <TextArea rows={2} aria-label="A change of mind" value={text} onChange={(e) => setText(e.target.value)} placeholder="“I used to think… Now I think… because…”" />
          <Button
            className="mt-2"
            variant="quiet"
            disabled={text.trim().length < 5}
            onClick={async () => {
              setData(await api("/me/mind-changes", { body: { text } }));
              setText("");
            }}
          >
            Add (private)
          </Button>
        </div>
        {delegate ? (
          <label className="flex items-start gap-2 border-t hairline pt-4 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={!!delegate.show_record}
              onChange={async (e) => onDelegate(await api("/delegates/me", { method: "PATCH", body: { show_record: e.target.checked } }))}
            />
            <span>
              Show my record on my Delegate’s public profile
              <span className="block text-xs text-ink-2">Only entries you mark public, plus the three counts above. Never which Chamber anything came from.</span>
            </span>
          </label>
        ) : (
          <p className="text-xs text-ink-2">Create a Delegate to share your record on a public profile.</p>
        )}
      </Card>
    </section>
  );
}
