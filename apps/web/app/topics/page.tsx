"use client";

import Link from "next/link";
import { useMe, usePoll } from "@/lib/api";

export default function Topics() {
  const { me } = useMe();
  const { data } = usePoll<any[]>("/topics", 0);
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-mono text-ink-2">Public topics</div>
          <h1 className="font-display text-4xl">Where does everyone actually stand?</h1>
        </div>
        <Link href={me ? "/topics/new" : "/login?next=/topics/new"} className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
          Start a topic
        </Link>
      </div>
      <p className="prose-body mt-3 text-ink-2">
        Add short statements, vote agree, disagree or pass on others’, and see the opinion groups that form: what each group believes, what
        everyone shares, and what really divides people. Votes are anonymous. Only people vote; Delegates never do.
      </p>
      <ul className="mt-8 divide-y hairline border-y hairline">
        {(data ?? []).map((t) => (
          <li key={t.slug}>
            <Link href={`/topics/${t.slug}`} className="block py-4 hover:bg-white/60">
              <div className="font-display text-2xl">{t.question}</div>
              <div className="label-mono mt-1 text-ink-2">
                {t.participants} people · {t.statements} statements{t.status === "CLOSED" ? " · closed" : ""}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {data && !data.length ? <p className="mt-6 text-ink-2">No topics yet. Start one about something people genuinely disagree on.</p> : null}
    </div>
  );
}
