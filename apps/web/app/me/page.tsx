"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, setToken, usePoll, useMe } from "@/lib/api";
import { Button, Card, DelegateBadge, EpistemicTag, ErrorNote, SectionTitle, TextArea } from "@/components/ui";
import { LearnedReview } from "@/components/LearnedReview";

export default function Me() {
  const router = useRouter();
  const { me } = useMe();
  const { data: d, setData: setD, error: dErr } = usePoll<any>(me?.has_delegate ? "/delegates/me" : null, 0);
  const { data: positions, reload } = usePoll<any[]>(me?.has_delegate ? "/delegates/me/positions" : null, 0);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState("");

  if (!me) return null;

  async function run(fn: () => Promise<any>) {
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
      <div>
        <div className="label-mono text-ink-2">Me</div>
        <h1 className="font-display text-4xl">{me.name}</h1>
        <p className="text-sm text-ink-2">{me.email}</p>
      </div>
      <ErrorNote error={error} />

      {!me.has_delegate ? (
        <Card>
          <p>You’re taking part as a guest, without a Delegate.</p>
          <Link href="/onboarding">
            <Button className="mt-3">Create my Delegate</Button>
          </Link>
        </Card>
      ) : d ? (
        <section>
          <SectionTitle kicker="Your Delegate">Who represents you</SectionTitle>
          <Card className="space-y-4">
            <DelegateBadge name={d.name} ownerName={me.name} handle={d.handle} seed={d.glyph_seed} />
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <label>
                Autonomy
                <select
                  value={d.autonomy}
                  onChange={async (e) => setD(await api("/delegates/me", { method: "PATCH", body: { autonomy: e.target.value } }))}
                  className="mt-1 w-full rounded-md border hairline bg-white px-2 py-1.5"
                >
                  <option value="L1">Draft-and-approve (default)</option>
                  <option value="L0">Silent: never drafts</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={d.status}
                  onChange={async (e) => setD(await api("/delegates/me", { method: "PATCH", body: { status: e.target.value } }))}
                  className="mt-1 w-full rounded-md border hairline bg-white px-2 py-1.5"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </label>
              <div>
                Public profile
                <Link href={`/d/${d.handle}`} className="mt-2 block underline">
                  @{d.handle}
                </Link>
              </div>
            </div>
            <p className="text-xs text-ink-2">Your Delegate can never approve agreements, endorse positions or consent to publishing. Only you can.</p>
          </Card>
        </section>
      ) : (
        <ErrorNote error={dErr?.message ?? null} />
      )}

      {me.has_delegate ? <LearnedReview onChange={reload} /> : null}

      {me.has_delegate ? (
        <section>
          <SectionTitle kicker="Memory Inspector">Everything your Delegate knows about you</SectionTitle>
          <p className="mb-4 text-sm text-ink-2">
            <strong>General</strong> positions can be used to draft for you in any Chamber. <strong>Chamber</strong> positions are locked to
            the Chamber they came from and are never used anywhere else.
          </p>
          <div className="space-y-3">
            {(positions ?? []).map((p) => (
              <PositionRow key={p.id} p={p} onChange={reload} setError={setError} />
            ))}
          </div>
          <Card className="mt-4">
            <TextArea rows={2} value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Teach your Delegate a position in your own words" />
            <Button
              className="mt-2"
              disabled={newText.trim().length < 3}
              onClick={() =>
                run(async () => {
                  await api("/delegates/me/positions", { body: { statement: newText } });
                  setNewText("");
                })
              }
            >
              Add position
            </Button>
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle kicker="Your data">Export or delete</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const data = await api("/me/export");
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "argumente-export.json";
              a.click();
            }}
          >
            Export my data (JSON)
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm("Delete your account, Delegate and all your positions? This can't be undone.")) return;
              await api("/me", { method: "DELETE" });
              setToken(null);
              router.push("/login");
            }}
          >
            Delete my account
          </Button>
        </div>
      </section>
    </div>
  );
}

function PositionRow({ p, onChange, setError }: { p: any; onChange: () => void; setError: (e: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(p.statement);
  const [because, setBecause] = useState("");
  const isChamber = p.scope_type === "CHAMBER";

  async function patch(body: any) {
    try {
      await api(`/delegates/me/positions/${p.id}`, { method: "PATCH", body });
      setEditing(false);
      onChange();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <EpistemicTag status={p.status} />
        <span className="label-mono rounded border hairline px-1.5 py-0.5 text-ink-2">
          {isChamber ? `Chamber · ${p.source.replace("CHAMBER:", "")}` : p.scope_type === "PUBLIC" ? "General · public" : "General · private"}
        </span>
        {p.stance ? <span className="label-mono text-ink-2">{p.stance}</span> : null}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <TextArea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          <TextArea rows={1} value={because} onChange={(e) => setBecause(e.target.value)} placeholder="Changed your mind? Say why (optional, kept in history)" />
          <div className="flex gap-2">
            <Button onClick={() => patch({ statement: text, changed_mind_because: because || undefined })}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="font-body mt-2">{p.statement}</p>
      )}
      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <button className="underline" onClick={() => setEditing(true)}>
            Edit
          </button>
          {!isChamber ? (
            <button className="underline" onClick={() => patch({ scope_type: p.scope_type === "PUBLIC" ? "PRIVATE" : "PUBLIC" })}>
              Make {p.scope_type === "PUBLIC" ? "private" : "public"}
            </button>
          ) : null}
          <button
            className="text-crux underline"
            onClick={async () => {
              await api(`/delegates/me/positions/${p.id}`, { method: "DELETE" });
              onChange();
            }}
          >
            Retract
          </button>
          {p.history?.length ? (
            <details>
              <summary className="cursor-pointer text-ink-2">History ({p.history.length})</summary>
              <ul className="mt-1 space-y-0.5 text-ink-2">
                {p.history.map((h: any, i: number) => (
                  <li key={i}>
                    {new Date(h.at).toLocaleDateString()}: {h.event}
                    {h.because ? `, because ${h.because}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
