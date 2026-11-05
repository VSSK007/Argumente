"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { passkeysSupported, signInWithPasskey } from "@/lib/webauthn";
import { Button, Card, ErrorNote, Input } from "@/components/ui";

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ delivery: string; dev_link?: string } | null>(null);
  const [config, setConfig] = useState<{ dev_login: boolean; email_delivery: string } | null>(null);
  const [devUsers, setDevUsers] = useState<{ email: string; name: string }[]>([]);
  const [canPasskey, setCanPasskey] = useState(false);

  useEffect(() => {
    api("/auth/config").then(setConfig).catch(() => null);
    api("/auth/dev-users").then(setDevUsers).catch(() => null);
    setCanPasskey(passkeysSupported());
  }, []);

  function finish(r: { token: string; user: { has_delegate: boolean } }, to = next) {
    setToken(r.token);
    router.push(r.user.has_delegate || to.startsWith("/join") ? to : `/onboarding?next=${encodeURIComponent(to)}`);
  }

  async function sendLink() {
    setError(null);
    try {
      setSent(await api("/auth/magic-link", { body: { email, name: name || null, is_adult: adult, next } }));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-4xl leading-tight">Sign in to Argumenté</h1>
      <p className="prose-body mt-3 text-ink-2">No password. We email you a link that works once, or you can use a passkey on this device.</p>

      {sent ? (
        <Card className="mt-8 space-y-3">
          <p className="font-display text-2xl" role="status">Check your email</p>
          <p className="text-sm text-ink-2">
            We sent a sign-in link to <strong className="text-ink">{email}</strong>. It works once and expires in 15 minutes.
          </p>
          {sent.dev_link ? (
            <div className="rounded-md bg-engine-tint/60 p-3 text-sm">
              <p className="text-engine">Development mode: no email is sent. Open the link directly:</p>
              <a href={sent.dev_link} className="mt-2 inline-block rounded-md bg-ink px-3 py-1.5 text-paper">
                Open sign-in link
              </a>
            </div>
          ) : sent.delivery === "console" ? (
            <p className="text-xs text-ink-2">This server has no email service configured; the link is in the API server’s log.</p>
          ) : null}
          <button className="text-sm underline" onClick={() => setSent(null)}>
            Use a different email
          </button>
        </Card>
      ) : (
        <Card className="mt-8">
          <form
            className="space-y-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              sendLink();
            }}
          >
            <label className="block text-sm">
              Email
              <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>
            <label className="block text-sm">
              Your name <span className="text-ink-2">(new here? we’ll create your account)</span>
              <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya" />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1" />
              <span>I am 18 or older.</span>
            </label>
            <Button type="submit" className="w-full" disabled={!email || !adult}>
              Email me a sign-in link
            </Button>
          </form>
          {canPasskey ? (
            <div className="mt-4 border-t hairline pt-4">
              <Button
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  setError(null);
                  try {
                    finish(await signInWithPasskey());
                  } catch (e: any) {
                    setError(e?.name === "NotAllowedError" ? "Passkey sign-in was cancelled." : e.message);
                  }
                }}
              >
                Sign in with a passkey
              </Button>
              <p className="mt-1 text-xs text-ink-2">Add a passkey from Me once you’re signed in.</p>
            </div>
          ) : null}
          <ErrorNote error={error} />
        </Card>
      )}

      {config?.dev_login ? (
        <details className="mt-6 rounded-lg border border-dashed hairline p-4">
          <summary className="cursor-pointer text-sm text-ink-2">Developer sign-in (local only, ARGUMENTE_DEV=1)</summary>
          <p className="mt-2 text-xs text-ink-2">Instant account switching for testing multi-person Chambers. Disabled on real deployments.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {devUsers.map((u) => (
              <button
                key={u.email}
                onClick={async () => finish(await api("/auth/login", { body: { email: u.email, name: u.name, is_adult: true } }))}
                className="rounded-full border hairline bg-white px-3 py-1 text-sm hover:border-ink"
              >
                {u.name} <span className="text-ink-2">· {u.email}</span>
              </button>
            ))}
            {!devUsers.length ? <span className="text-xs text-ink-2">No local accounts yet.</span> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
