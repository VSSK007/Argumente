"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useMe } from "@/lib/api";

/** Report public content to the moderators. */
export function ReportLink({ type, id }: { type: "map" | "delegate" | "topic" | "statement"; id: string }) {
  const { me } = useMe();
  const [state, setState] = useState<"idle" | "open" | "sent">("idle");
  const [reason, setReason] = useState("");
  if (!me) return <Link href="/login" className="underline">Sign in to report</Link>;
  if (state === "sent") return <span className="text-agree">Reported. Thank you.</span>;
  if (state === "idle")
    return (
      <button className="underline" onClick={() => setState("open")}>
        Report
      </button>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input aria-label="Why are you reporting this?" className="rounded border hairline bg-white px-2 py-1 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What’s wrong?" />
      <button
        className="underline disabled:opacity-40"
        disabled={reason.trim().length < 3}
        onClick={async () => {
          await api("/reports", { body: { target_type: type, target_id: id, reason } });
          setState("sent");
        }}
      >
        Send report
      </button>
    </span>
  );
}
