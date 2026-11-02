"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Glyph, HumanAvatar, MediatorBadge, TypeChip } from "@/components/ui";

/** Public landing page with a scripted, offline 60-second replay of a Chamber. */

type Step = { title: string; caption: string; render: () => React.ReactNode };

const ANA = "Ana";
const TOM = "Tom";
const QUESTION = "Should rent be split by room size?";

function Person({ name, children }: { name: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <HumanAvatar name={name} size={28} />
      <span className="font-medium">{name}</span>
      {children}
    </div>
  );
}

function Bubble({ who, tone = "human", children }: { who: React.ReactNode; tone?: "human" | "delegate" | "mediator"; children: React.ReactNode }) {
  const cls =
    tone === "delegate"
      ? "border-l-2 border-delegate bg-delegate-tint/50"
      : tone === "mediator"
        ? "border-l-2 border-engine/60 bg-engine-tint/50 italic"
        : "border hairline bg-white";
  return (
    <div className={`demo-in rounded-md p-3 ${cls}`}>
      <div className="mb-1 text-sm">{who}</div>
      <div className="font-body">{children}</div>
    </div>
  );
}

function Tag({ children, tone = "agree" }: { children: React.ReactNode; tone?: "agree" | "delegate" | "engine" | "crux" }) {
  const cls = { agree: "bg-agree-tint text-agree", delegate: "bg-delegate-tint text-delegate", engine: "bg-engine-tint text-engine", crux: "bg-[#FFF4ED] text-crux" }[tone];
  return <span className={`label-mono rounded px-1.5 py-0.5 ${cls}`}>{children}</span>;
}

function Bar({ from, to, label }: { from: number; to: number; label: string }) {
  const [w, setW] = useState(from);
  useEffect(() => {
    const t = setTimeout(() => setW(to), 400);
    return () => clearTimeout(t);
  }, [to]);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs">
          {from}% → <strong className="text-agree">{w}%</strong>
        </span>
      </div>
      <div className="relative mt-1 h-3 rounded-full bg-paper-2">
        <div className="absolute inset-y-0 left-0 rounded-full bg-rule" style={{ width: `${from}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-agree transition-all duration-1000" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    title: "Two people, one question",
    caption: "Ana and Tom share a flat. They’ve had the rent argument three times. This time they open a Chamber.",
    render: () => (
      <div className="space-y-4">
        <p className="demo-in font-display text-3xl leading-tight">{QUESTION}</p>
        <div className="demo-in flex gap-6">
          <Person name={ANA} />
          <Person name={TOM} />
        </div>
      </div>
    ),
  },
  {
    title: "Positions are private",
    caption: "Each person writes where they stand, alone. Nobody else ever sees their exact words, so nobody performs for an audience.",
    render: () => (
      <div className="grid gap-3 md:grid-cols-2">
        {[
          [ANA, "My room is the smallest and I pay the same. Rent should follow room size."],
          [TOM, "We share the kitchen and living room equally. The big room was first come, first served."],
        ].map(([n, t]) => (
          <div key={n} className="demo-in rounded-md border hairline bg-white p-3">
            <Person name={n}>
              <Tag tone="delegate">🔒 only {n} sees this</Tag>
            </Person>
            <p className="mt-2 select-none font-body blur-[3px]" aria-hidden>
              {t}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Delegates go first",
    caption: "Their AI Delegates sketch each side from positions they’ve approved, always in the third person, always labelled AI. Each owner edits and releases their own.",
    render: () => (
      <div className="space-y-3">
        <Bubble
          tone="delegate"
          who={
            <span className="inline-flex items-center gap-2">
              <Glyph seed="ana-demo" size={20} /> <strong>Juniper</strong> · Delegate of Ana <Tag tone="delegate">AI</Tag> <Tag>Endorsed</Tag>
            </span>
          }
        >
          Ana holds that whoever gets more space should pay more of the rent.
        </Bubble>
        <Bubble
          tone="delegate"
          who={
            <span className="inline-flex items-center gap-2">
              <Glyph seed="tom-demo" size={20} /> <strong>Atlas</strong> · Delegate of Tom <Tag tone="delegate">AI</Tag> <Tag>Endorsed</Tag>
            </span>
          }
        >
          Tom holds that shared rooms are most of what you pay for. He hasn’t said anything about bills, so I can’t speak to that.
        </Bubble>
      </div>
    ),
  },
  {
    title: "Is this what you mean?",
    caption: "A neutral Mediator explains each view to the group. Tom says ‘not quite’, the Mediator revises, and Tom accepts. Nothing moves on until everyone has.",
    render: () => (
      <div className="space-y-3">
        <Bubble tone="mediator" who={<MediatorBadge />}>
          Tom thinks equal rent is fair because the big room was a first-come choice.
        </Bubble>
        <div className="demo-in text-sm">
          <Person name={TOM}>
            <span className="text-ink-2">“Not quite. It’s mostly that we use the shared rooms equally.”</span>
          </Person>
        </div>
        <Bubble tone="mediator" who={<MediatorBadge />}>
          Tom’s view: most of what the rent buys is shared space everyone uses equally, so equal shares fit. How the rooms were picked matters less.
        </Bubble>
        <div className="demo-in">
          <Tag>✓ Tom: yes, that’s me</Tag> <Tag>✓ Ana: yes, that’s me</Tag>
        </div>
      </div>
    ),
  },
  {
    title: "The Understanding Map",
    caption: "Not who’s right: where exactly they differ, what kind of difference it is, and the one belief that would change each mind.",
    render: () => (
      <div className="space-y-3">
        <div className="demo-in rounded-md border-l-2 border-agree bg-white p-3 font-body">Shared: both want a split neither resents.</div>
        <div className="demo-in rounded-md border hairline bg-white p-3">
          <TypeChip type="VALUE" /> <span className="font-body">Fairness by space used, or by shared use?</span>
          <p className="mt-1 text-sm italic text-ink-2">More facts won’t settle this. A rule you both accept might.</p>
        </div>
        <div className="demo-in rounded-md border hairline bg-white p-3">
          <TypeChip type="FACT" /> <span className="font-body">How much of the flat is shared space?</span>
          <p className="mt-1 text-sm italic text-ink-2">This one you can measure together.</p>
        </div>
        <p className="demo-in font-body">
          <span className="text-crux">◆</span> <strong>Tom’s crux:</strong> if the shared rooms are under half the flat, he’d reconsider. <Tag tone="crux">confirmed by Tom</Tag>
        </p>
      </div>
    ),
  },
  {
    title: "Steelman Exchange",
    caption: "Ana writes Tom’s view in her own words. Tom rates it. Four stars or more and it counts. Understanding, not winning, is what earns standing.",
    render: () => (
      <div className="space-y-3">
        <Bubble who={<Person name={ANA}><span className="text-ink-2">steelmans Tom</span></Person>}>
          “Tom isn’t defending a perk. He’s saying the rent mostly buys rooms we share, so splitting by bedroom size overweights the part that matters least.”
        </Bubble>
        <div className="demo-in flex items-center gap-2 text-sm">
          <span className="font-mono">★★★★★</span> <strong className="text-agree">Accepted by Tom</strong>{" "}
          <span className="text-ink-2">“Honestly, better than I put it.”</span>
        </div>
      </div>
    ),
  },
  {
    title: "Understanding Score",
    caption: "Before reading the Map, each guessed where the other stands. Afterwards they guessed again. This is the part no other app measures.",
    render: () => (
      <div className="demo-in space-y-4">
        <Bar label="Ana understood Tom" from={40} to={90} />
        <Bar label="Tom understood Ana" from={50} to={85} />
      </div>
    ),
  },
  {
    title: "Agree, or honestly agree to disagree",
    caption: "They measure the flat (shared rooms: 58%), keep equal rent, and give Ana the bigger wardrobe. Both approve, item by item. The AI never decides anything.",
    render: () => (
      <div className="space-y-3">
        <div className="demo-in rounded-md border hairline bg-white p-3">
          <p className="font-body">Equal rent for now; Ana gets the hall wardrobe; review in six months.</p>
          <div className="mt-2 flex gap-2">
            <span className="rounded-full border border-agree px-2 py-0.5 text-xs text-agree">✓ Ana</span>
            <span className="rounded-full border border-agree px-2 py-0.5 text-xs text-agree">✓ Tom</span>
          </div>
        </div>
        <p className="demo-in text-sm text-ink-2">🔒 Sealed predictions: “We won’t need the review.” · “We will.” Opened when they revisit.</p>
      </div>
    ),
  },
];

const STEP_MS = 7000;

function Demo() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current || !ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setPlaying(true), { threshold: 0.5 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => (i < STEPS.length - 1 ? setI(i + 1) : setPlaying(false)), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, i]);

  const s = STEPS[i];
  return (
    <div ref={ref} id="demo" className="scroll-mt-24 rounded-xl border hairline bg-white/60 p-4 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="label-mono text-ink-2">
            Demo · {i + 1} of {STEPS.length}
          </div>
          <h3 className="font-display text-2xl">{s.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border hairline px-3 py-1.5 text-sm hover:border-ink disabled:opacity-30" disabled={i === 0} onClick={() => { setPlaying(false); setI(i - 1); }} aria-label="Previous step">
            ←
          </button>
          <button className="rounded-md bg-ink px-3 py-1.5 text-sm text-paper" onClick={() => (i === STEPS.length - 1 && !playing ? (setI(0), setPlaying(true)) : setPlaying(!playing))}>
            {playing ? "Pause" : i === STEPS.length - 1 ? "Replay" : "Play"}
          </button>
          <button className="rounded-md border hairline px-3 py-1.5 text-sm hover:border-ink disabled:opacity-30" disabled={i === STEPS.length - 1} onClick={() => { setPlaying(false); setI(i + 1); }} aria-label="Next step">
            →
          </button>
        </div>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-paper-2" aria-hidden>
        <div key={`${i}-${playing}`} className={`h-1 bg-ink ${playing ? "demo-progress" : ""}`} style={{ width: playing ? undefined : `${((i + 1) / STEPS.length) * 100}%`, animationDuration: `${STEP_MS}ms` }} />
      </div>
      <div key={i} className="mt-5 min-h-[260px]">
        {s.render()}
      </div>
      <p className="mt-4 border-t hairline pt-3 text-sm text-ink-2" aria-live="polite">
        {s.caption}
      </p>
      <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Demo steps">
        {STEPS.map((st, k) => (
          <button
            key={st.title}
            onClick={() => { setPlaying(false); setI(k); }}
            aria-current={k === i ? "step" : undefined}
            aria-label={`Step ${k + 1}: ${st.title}`}
            className="group flex h-6 min-w-6 items-center justify-center"
          >
            <span className={`block h-2.5 rounded-full transition-all ${k === i ? "w-8 bg-ink" : "w-2.5 bg-rule group-hover:bg-ink-2"}`} />
          </button>
        ))}
      </nav>
    </div>
  );
}

const PRINCIPLES = [
  ["Understanding before resolution", "No one can propose a solution until everyone confirms their view was explained right."],
  ["AI that never speaks as you", "Delegates speak about you, in the third person, only from what you’ve approved, and say what they don’t know."],
  ["Nothing shared without you", "Your words stay private. Agreements, publishing and memory all need your explicit yes."],
  ["Disagreement is allowed", "“Understood, still disagree” is a real ending. The goal is accuracy, not consensus."],
];

export function Landing() {
  return (
    <div className="space-y-16">
      <section className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div>
          <div className="label-mono text-ink-2">Social Argumentative Intelligence</div>
          <h1 className="mt-2 font-display text-5xl leading-[1.05] md:text-6xl">
            Disagree.
            <br />
            Debate.
            <br />
            <span className="italic">Understand.</span>
          </h1>
          <p className="prose-body mt-5 max-w-xl text-ink-2">
            Bring a disagreement or a shared decision. Everyone says where they stand, privately. A neutral AI Mediator explains each view
            back until people say <em>“yes, that’s me”</em>. Then you see where you really differ, and how much better you understand each
            other.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-black">
              Start a Chamber
            </Link>
            <a href="#demo" className="rounded-md border border-ink px-5 py-2.5 text-sm font-medium hover:bg-paper-2">
              Watch the 60-second demo
            </a>
          </div>
        </div>
        <div className="hidden md:block" aria-hidden>
          <div className="relative mx-auto h-72 w-72">
            <div className="absolute left-0 top-8 rotate-[-4deg] rounded-lg border hairline bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm">
                <Glyph seed="hero-a" size={22} /> Delegate of Ana <Tag tone="delegate">AI</Tag>
              </div>
              <p className="mt-2 w-52 font-body text-sm">Ana holds that more space should mean more rent.</p>
            </div>
            <div className="absolute bottom-6 right-0 rotate-[3deg] rounded-lg border-l-2 border-engine/60 bg-engine-tint p-4 shadow-sm">
              <MediatorBadge />
              <p className="mt-2 w-52 font-body text-sm italic">Is this what you mean, Tom?</p>
              <div className="mt-2">
                <Tag>✓ yes, that’s me</Tag>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Demo />

      <section>
        <h2 className="font-display text-3xl">What makes it different</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {PRINCIPLES.map(([t, d]) => (
            <div key={t} className="rounded-lg border hairline bg-white/60 p-5">
              <h3 className="font-display text-xl">{t}</h3>
              <p className="mt-1 text-sm text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-ink p-8 text-paper">
        <h2 className="font-display text-3xl">Bring the argument you keep having.</h2>
        <p className="mt-2 max-w-xl text-sm opacity-80">The trip, the chores, the rent, the family holidays. Invite the people involved; they don’t need an account to start.</p>
        <Link href="/login" className="mt-5 inline-block rounded-md bg-paper px-5 py-2.5 text-sm font-medium text-ink">
          Start a Chamber
        </Link>
      </section>
    </div>
  );
}
