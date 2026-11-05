"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, usePoll } from "@/lib/api";
import { Button, Card, ErrorNote, SectionTitle, TextArea } from "@/components/ui";

export default function SparHome() {
  const router = useRouter();
  const [claim, setClaim] = useState("");
  const [mode, setMode] = useState("devils_advocate");
  const [methodology, setMethodology] = useState("socratic");
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const { data: sessions } = usePoll<any[]>("/spar", 0);

  useEffect(() => {
    api("/position-cards").then((r) => setMethods(r.methodologies));
  }, []);

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_300px]">
      <div>
        <div className="label-mono text-ink-2">Spar</div>
        <h1 className="font-display text-4xl">Test an argument against something that won’t flatter you.</h1>
        <Card className="mt-6 space-y-4">
          <label className="block text-sm">
            Your claim
            <TextArea rows={3} value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="e.g. Remote work makes teams more productive because people have fewer interruptions." />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { k: "devils_advocate", t: "Devil’s Advocate", d: "It argues against you." },
              { k: "steelman", t: "Steelman", d: "It shows you the best opposing case." },
            ].map((m) => (
              <button key={m.k} onClick={() => setMode(m.k)} className={`rounded-lg border p-3 text-left ${mode === m.k ? "border-ink bg-white" : "hairline"}`}>
                <div className="font-medium">{m.t}</div>
                <div className="text-xs text-ink-2">{m.d}</div>
              </button>
            ))}
          </div>
          <label className="block text-sm">
            Opponent’s methodology
            <select value={methodology} onChange={(e) => setMethodology(e.target.value)} className="mt-1 w-full rounded-md border hairline bg-white px-3 py-2">
              {Object.entries(methods).map(([k, d]) => (
                <option key={k} value={k}>
                  {k}: {d}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={claim.trim().length < 5}
            onClick={async () => {
              setError(null);
              try {
                const s = await api("/spar", { body: { claim, mode, methodology } });
                router.push(`/spar/${s.id}`);
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            Start sparring
          </Button>
          <ErrorNote error={error} />
        </Card>
      </div>
      <div>
        <SectionTitle kicker="History">Past sessions</SectionTitle>
        <ul className="space-y-2">
          {(sessions ?? []).map((s) => (
            <li key={s.id}>
              <Link href={`/spar/${s.id}`} className="block rounded-md border hairline bg-white/60 p-3 text-sm hover:border-ink">
                <div className="line-clamp-2">{s.claim}</div>
                <div className="label-mono mt-1 text-ink-2">
                  {s.status === "FINISHED" ? s.report?.verdict : `round ${s.rounds}/${s.max_rounds}`}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
