"use client";

import Link from "next/link";
import { usePoll } from "@/lib/api";

export default function Commons() {
  const { data } = usePoll<any[]>("/public/maps", 0);
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="label-mono text-ink-2">Commons</div>
      <h1 className="font-display text-4xl">Understanding Maps, published with everyone’s consent.</h1>
      <p className="mt-3 text-sm text-ink-2">
        Looking for open questions to weigh in on? See{" "}
        <Link href="/topics" className="underline">
          public topics
        </Link>
        .
      </p>
      <ul className="mt-8 divide-y hairline border-y hairline">
        {(data ?? []).map((m) => (
          <li key={m.slug}>
            <Link href={`/m/${m.slug}`} className="block py-4 hover:bg-white/60">
              <div className="font-display text-2xl">{m.headline}</div>
              <div className="label-mono mt-1 text-ink-2">
                {m.participants} people · {m.differences} differences · {m.cruxes} cruxes
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {data && !data.length ? <p className="mt-6 text-ink-2">Nothing published yet. Maps appear here when every participant consents.</p> : null}
    </div>
  );
}
