"use client";

import Link from "next/link";
import { usePoll, useMe } from "@/lib/api";
import { Card, SectionTitle } from "@/components/ui";

type ChamberRow = {
  id: string;
  title: string;
  question: string;
  template: string;
  state: string;
  paused: boolean;
  closed_state: string | null;
  member_names: string[];
  needs_you: string | null;
};

const STATE_LABEL: Record<string, string> = {
  INTAKE: "Gathering positions",
  ANALYZING: "Mediator is reading",
  RESTATEMENT: "Checking restatements",
  MAPPING: "Drawing the Map",
  MAP: "Understanding Map ready",
  OPTIONS_PENDING: "Finding options",
  RESOLUTION: "Options & agreement",
  CLOSED: "Closed",
};

export default function Today() {
  const { me } = useMe();
  const { data } = usePoll<ChamberRow[]>(me ? "/chambers" : null, 4000);
  if (!me) return null;
  const needs = (data ?? []).filter((c) => c.needs_you);
  const active = (data ?? []).filter((c) => c.state !== "CLOSED");
  const closed = (data ?? []).filter((c) => c.state === "CLOSED");

  return (
    <div className="space-y-10">
      <div>
        <div className="label-mono text-ink-2">Today</div>
        <h1 className="font-display text-4xl">Hello, {me.name}.</h1>
      </div>

      {needs.length ? (
        <section>
          <SectionTitle kicker="Needs you">Your turn</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {needs.map((c) => (
              <Link key={c.id} href={`/chambers/${c.id}`}>
                <Card className="border-ink transition hover:bg-white">
                  <div className="label-mono text-delegate">{c.needs_you}</div>
                  <div className="mt-1 font-display text-xl">{c.title}</div>
                  <div className="mt-1 text-sm text-ink-2">{c.question}</div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle kicker="Start">Bring something to the table</SectionTitle>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { href: "/chambers/new?template=decision", t: "Decision", d: "A trip, a purchase, a plan." },
            { href: "/chambers/new?template=disagreement", t: "Disagreement", d: "You see it differently." },
            { href: "/chambers/new?template=household", t: "Household", d: "Chores, bills, guests." },
            { href: "/spar", t: "Spar", d: "Test your own argument." },
          ].map((x) => (
            <Link key={x.href} href={x.href}>
              <Card className="h-full transition hover:border-ink hover:bg-white">
                <div className="font-display text-xl">{x.t}</div>
                <div className="text-sm text-ink-2">{x.d}</div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle kicker="Chambers">Active</SectionTitle>
        {!active.length ? <p className="text-ink-2">No active Chambers. Start one above and share the invite link with the people involved.</p> : null}
        <ul className="divide-y hairline border-y hairline">
          {active.map((c) => (
            <li key={c.id}>
              <Link href={`/chambers/${c.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-white/60">
                <div>
                  <div className="font-display text-lg">{c.title}</div>
                  <div className="text-sm text-ink-2">{c.member_names.join(", ")}</div>
                </div>
                <div className="label-mono text-right text-ink-2">{c.paused ? "Paused" : STATE_LABEL[c.state]}</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {closed.length ? (
        <section>
          <SectionTitle kicker="Record">Closed</SectionTitle>
          <ul className="divide-y hairline border-y hairline">
            {closed.map((c) => (
              <li key={c.id}>
                <Link href={`/chambers/${c.id}`} className="flex items-center justify-between py-3 hover:bg-white/60">
                  <span className="font-display">{c.title}</span>
                  <span className="label-mono text-ink-2">{c.closed_state?.toLowerCase()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
