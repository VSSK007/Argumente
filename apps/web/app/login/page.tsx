"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Button, Card, ErrorNote, Input } from "@/components/ui";

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devUsers, setDevUsers] = useState<{ email: string; name: string }[]>([]);

  useEffect(() => {
    api("/auth/dev-users").then(setDevUsers).catch(() => null);
  }, []);

  async function login(e: string, n: string, isAdult: boolean) {
    setError(null);
    try {
      const r = await api<{ token: string; user: { has_delegate: boolean } }>("/auth/login", { body: { email: e, name: n, is_adult: isAdult } });
      setToken(r.token);
      router.push(r.user.has_delegate || next.startsWith("/join") ? next : `/onboarding?next=${encodeURIComponent(next)}`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-4xl leading-tight">Disagree. Debate. Understand.</h1>
      <p className="prose-body mt-3 text-ink-2">
        Bring a disagreement or a shared decision. Everyone states their view privately, a neutral Mediator explains each view back
        until people say <em>“yes, that’s what I mean”</em>, and then you see where you really differ.
      </p>
      <Card className="mt-8">
        <form
          className="space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            login(email, name, adult);
          }}
        >
          <label className="block text-sm">
            Your name
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya" required />
          </label>
          <label className="block text-sm">
            Email
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" required />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1" />
            <span>I am 18 or older.</span>
          </label>
          <Button type="submit" className="w-full">
            Continue
          </Button>
          <p className="text-xs text-ink-2">Local development mode: no password, and the account is created on first sign-in.</p>
        </form>
        <ErrorNote error={error} />
      </Card>
      {devUsers.length ? (
        <div className="mt-6">
          <div className="label-mono text-ink-2">Switch to an existing local account</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {devUsers.map((u) => (
              <button key={u.email} onClick={() => login(u.email, u.name, true)} className="rounded-full border hairline bg-white px-3 py-1 text-sm hover:border-ink">
                {u.name} <span className="text-ink-2">· {u.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-2">Tip: to test a Chamber alone, open a second browser profile or a private window as another person.</p>
        </div>
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
