"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api, getToken, setToken, useMe, usePoll } from "@/lib/api";

/* ------------------------------------------------------------------ primitives */

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  const styles = {
    primary: "bg-ink text-paper hover:bg-black",
    secondary: "border border-ink text-ink hover:bg-paper-2",
    ghost: "text-ink-2 hover:text-ink hover:bg-paper-2",
    danger: "border border-crux text-crux hover:bg-crux hover:text-white",
    quiet: "border hairline text-ink hover:border-ink",
  }[variant];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled || busy}
      onClick={async () => {
        if (!onClick) return;
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {busy ? <span className="thinking-dot">…</span> : null}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border hairline bg-white/60 p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({ kicker, children }: { kicker?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      {kicker ? <div className="label-mono text-ink-2">{kicker}</div> : null}
      <h2 className="font-display text-2xl leading-tight">{children}</h2>
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mt-2 rounded-md border border-crux/40 bg-crux/5 px-3 py-2 text-sm text-crux">{error}</p>;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`prose-body w-full rounded-md border hairline bg-white p-3 outline-none focus:border-ink ${props.className ?? ""}`}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border hairline bg-white px-3 py-2 outline-none focus:border-ink ${props.className ?? ""}`}
    />
  );
}

/* ------------------------------------------------------------------ identity grammar */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const GLYPH_PALETTE = ["#3B5BDB", "#5F3DC4", "#0B7285", "#2B8A3E", "#A61E4D", "#8A6D3B", "#364FC7", "#495057"];

/** Deterministic geometric glyph for a Delegate. Never a face. */
export function Glyph({ seed, size = 36 }: { seed: string; size?: number }) {
  const h = hash(seed);
  const c1 = GLYPH_PALETTE[h % GLYPH_PALETTE.length];
  const c2 = GLYPH_PALETTE[(h >>> 3) % GLYPH_PALETTE.length];
  const cells = Array.from({ length: 9 }, (_, i) => (h >>> (i + 5)) & 1);
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden className="shrink-0" style={{ borderRadius: "var(--radius-delegate)" }}>
      <rect width="30" height="30" rx="6" fill={c1} />
      {cells.map((on, i) =>
        on ? <rect key={i} x={3 + (i % 3) * 8} y={3 + Math.floor(i / 3) * 8} width="8" height="8" rx="1.5" fill={c2} opacity={0.85} /> : null,
      )}
      <circle cx="15" cy="15" r="3.2" fill="#fff" opacity="0.9" />
    </svg>
  );
}

/** Humans are circles with initials. Delegates are rounded squares with glyphs. */
export function HumanAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-ink bg-paper font-ui text-xs font-semibold"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Required on every Delegate-rendered message (invariant 4). */
export function DelegateBadge({ name, ownerName, handle, seed }: { name: string; ownerName: string; handle?: string; seed: string }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={`${name}, AI Delegate of ${ownerName}`}>
      <Glyph seed={seed} size={22} />
      <span className="text-sm">
        <span className="font-medium">{name}</span>
        <span className="text-ink-2"> · Delegate of {ownerName}</span>
        {handle ? <span className="font-mono text-xs text-ink-2"> @{handle}</span> : null}
      </span>
      <span className="label-mono rounded bg-delegate-tint px-1.5 py-0.5 text-delegate">AI</span>
    </span>
  );
}

export function MediatorBadge() {
  return (
    <span className="inline-flex items-center gap-2" aria-label="Mediator, AI">
      <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md bg-engine-tint font-display text-engine">§</span>
      <span className="text-sm font-medium text-engine">Mediator</span>
      <span className="label-mono rounded bg-engine-tint px-1.5 py-0.5 text-engine">AI</span>
    </span>
  );
}

const EPI: Record<string, { label: string; cls: string; title: string }> = {
  ENDORSED: { label: "Endorsed", cls: "bg-agree-tint text-agree", title: "The person confirmed this in their own words." },
  PROPOSED: { label: "Mediator's reading", cls: "bg-engine-tint text-engine", title: "The Mediator's paraphrase or suggestion. Not confirmed." },
  INFERRED: { label: "Inferred", cls: "bg-engine-tint text-engine", title: "An inference by the AI. Not confirmed by the person." },
  DRAFT: { label: "Draft", cls: "bg-delegate-tint text-delegate", title: "A draft. Nobody else can see it until endorsed." },
  UNKNOWN: { label: "Unknown", cls: "bg-paper-2 text-ink-2", title: "Not known." },
};

export function EpistemicTag({ status }: { status: string }) {
  const e = EPI[status] ?? EPI.UNKNOWN;
  return (
    <span title={e.title} className={`label-mono inline-block rounded px-1.5 py-0.5 ${e.cls}`}>
      {e.label}
    </span>
  );
}

const TYPE_HELP: Record<string, string> = {
  FACT: "Could be settled by evidence",
  VALUE: "Different priorities",
  INTEREST: "Different stakes",
  INTERPRETATION: "Same events, different meaning",
  PREDICTION: "Different expectations",
  DEFINITION: "Same word, different meaning",
  POLICY: "A proposal",
};

export function TypeChip({ type }: { type: string }) {
  return (
    <span title={TYPE_HELP[type]} className="label-mono inline-block rounded border hairline bg-white px-1.5 py-0.5 text-ink">
      {type}
    </span>
  );
}

/* ------------------------------------------------------------------ protocol */

const STATES = [
  { key: "INTAKE", label: "Positions" },
  { key: "RESTATEMENT", label: "Restate" },
  { key: "MAP", label: "Map" },
  { key: "RESOLUTION", label: "Resolve" },
  { key: "CLOSED", label: "Close" },
];
const STATE_INDEX: Record<string, number> = {
  INTAKE: 0,
  ANALYZING: 0.5,
  RESTATEMENT: 1,
  MAPPING: 1.5,
  MAP: 2,
  OPTIONS_PENDING: 2.5,
  RESOLUTION: 3,
  CLOSED: 4,
};

export function StateRail({ state }: { state: string }) {
  const idx = STATE_INDEX[state] ?? 0;
  return (
    <ol className="flex items-center gap-1 overflow-x-auto" aria-label="Chamber progress">
      {STATES.map((s, i) => {
        const done = idx > i;
        const current = Math.floor(idx) === i;
        return (
          <li key={s.key} className="flex items-center gap-1">
            <span
              className={`label-mono whitespace-nowrap rounded-full px-2.5 py-1 ${
                current ? "bg-ink text-paper" : done ? "bg-paper-2 text-ink" : "text-ink-2"
              }`}
              aria-current={current ? "step" : undefined}
            >
              {done ? "✓ " : ""}
              {s.label}
            </span>
            {i < STATES.length - 1 ? <span className="h-px w-4 bg-rule" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function EngineThinking({ step }: { step?: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-engine/30 bg-engine-tint/60 p-4" role="status">
      <MediatorBadge />
      <div className="font-body italic text-engine">
        {step && step !== "queued" ? step : "Reading carefully"}
        <span className="thinking-dot">.</span>
        <span className="thinking-dot" style={{ animationDelay: "0.2s" }}>
          .
        </span>
        <span className="thinking-dot" style={{ animationDelay: "0.4s" }}>
          .
        </span>
      </div>
    </div>
  );
}

export function EngineBanner() {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => {
    api("/engine/status").then(setStatus).catch(() => null);
  }, []);
  if (!status || status.provider !== "local") return null;
  return (
    <div className="border-b hairline bg-engine-tint/60 px-4 py-1.5 text-center text-xs text-engine print:hidden">
      Offline engine: heuristic analysis that quotes people's own words. Set <span className="font-mono">ANTHROPIC_API_KEY</span> on the
      API for full AI analysis.
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

const NAV = [
  { href: "/", label: "Today" },
  { href: "/topics", label: "Topics" },
  { href: "/spar", label: "Spar" },
  { href: "/commons", label: "Commons" },
  { href: "/me", label: "Me" },
];

function Bell() {
  const { data } = usePoll<{ unread: number }>("/notifications/unread", 20000);
  const n = data?.unread ?? 0;
  return (
    <Link href="/inbox" className="relative rounded-md px-2 py-1 hover:bg-paper-2" aria-label={n ? `Inbox, ${n} unread` : "Inbox"}>
      <span aria-hidden>🔔</span>
      {n ? (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-crux px-1 text-center font-mono text-[10px] leading-[18px] text-white" aria-hidden>
          {n > 9 ? "9+" : n}
        </span>
      ) : null}
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { me } = useMe();
  const isPublic = path === "/" || path.startsWith("/m/") || path.startsWith("/login") || path.startsWith("/auth/") || path.startsWith("/commons") || path.startsWith("/design") || path === "/privacy" || path === "/terms" || (path.startsWith("/topics") && path !== "/topics/new");

  useEffect(() => {
    // Only redirect when there is genuinely no session: a token whose /me check is still in flight is not "signed out".
    if (me === null && !getToken() && !isPublic && !path.startsWith("/join")) router.replace(`/login?next=${encodeURIComponent(path)}`);
    if (me && !me.has_delegate && path === "/" && typeof window !== "undefined" && !sessionStorage.getItem("skip-onboarding"))
      router.replace("/onboarding");
  }, [me, path, isPublic, router]);

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <EngineBanner />
      <header className="sticky top-0 z-20 border-b hairline bg-paper/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-display text-xl tracking-tight">
            Argumenté
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {me
              ? NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`rounded-md px-3 py-1.5 text-sm ${path === n.href ? "bg-paper-2 text-ink" : "text-ink-2 hover:text-ink"}`}
                  >
                    {n.label}
                  </Link>
                ))
              : null}
            {me?.is_admin ? (
              <Link href="/admin" className={`rounded-md px-3 py-1.5 text-sm ${path === "/admin" ? "bg-paper-2 text-ink" : "text-ink-2 hover:text-ink"}`}>
                Moderation
              </Link>
            ) : null}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            {me ? (
              <>
                <Bell />
                <span className="hidden text-ink-2 sm:inline">{me.name}</span>
                <button
                  className="rounded-md px-2 py-1 text-ink-2 hover:bg-paper-2 hover:text-ink"
                  onClick={async () => {
                    await api("/auth/logout", { body: {} }).catch(() => null);
                    setToken(null);
                    router.push("/login");
                  }}
                >
                  Switch / sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="rounded-md px-2 py-1 hover:bg-paper-2">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-24 pt-4 text-xs text-ink-2 print:hidden md:pb-8">
        <Link href="/privacy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link> · AI can be wrong; this isn’t therapy or advice.
      </footer>
      {me ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t hairline bg-paper md:hidden print:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`py-3 text-center text-xs ${path === n.href ? "font-semibold text-ink" : "text-ink-2"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
