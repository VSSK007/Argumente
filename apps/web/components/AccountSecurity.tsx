"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken, usePoll, type User } from "@/lib/api";
import { passkeysSupported, registerPasskey } from "@/lib/webauthn";
import { Button, Card, ErrorNote, Input, SectionTitle } from "@/components/ui";

export function AccountSecurity({ me }: { me: User }) {
  const router = useRouter();
  const { data: keys, reload } = usePoll<any[]>("/me/passkeys", 0);
  const [name, setName] = useState("This device");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(passkeysSupported()), []);

  return (
    <section>
      <SectionTitle kicker="Sign-in">Account security</SectionTitle>
      <Card className="space-y-4">
        <p className="text-sm">
          {me.email}{" "}
          {me.email_verified ? (
            <span className="label-mono rounded bg-agree-tint px-1.5 py-0.5 text-agree">verified</span>
          ) : (
            <span className="label-mono rounded bg-paper-2 px-1.5 py-0.5 text-ink-2">not verified (developer sign-in)</span>
          )}
        </p>
        <div>
          <div className="label-mono text-ink-2">Passkeys</div>
          <ul className="mt-2 space-y-1 text-sm">
            {(keys ?? []).map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3">
                <span>🔑 {k.name}</span>
                <span className="text-xs text-ink-2">
                  added {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}` : ""}
                </span>
                <button
                  className="text-xs text-crux underline"
                  onClick={async () => {
                    await api(`/me/passkeys/${encodeURIComponent(k.id)}`, { method: "DELETE" });
                    reload();
                  }}
                >
                  remove
                </button>
              </li>
            ))}
            {keys && !keys.length ? <li className="text-ink-2">No passkeys yet. Add one to sign in without waiting for an email.</li> : null}
          </ul>
          {supported ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input aria-label="Passkey name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-[220px]" />
              <Button
                variant="quiet"
                onClick={async () => {
                  setError(null);
                  try {
                    await registerPasskey(name || "Passkey");
                    reload();
                  } catch (e: any) {
                    setError(e?.name === "NotAllowedError" ? "Passkey creation was cancelled." : e.message);
                  }
                }}
              >
                Add a passkey
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-2">This browser doesn’t support passkeys.</p>
          )}
          <ErrorNote error={error} />
        </div>
        <div className="border-t hairline pt-3">
          <Button
            variant="ghost"
            onClick={async () => {
              await api("/auth/logout-everywhere", { body: {} });
              setToken(null);
              router.push("/login");
            }}
          >
            Sign out on every device
          </Button>
        </div>
      </Card>
    </section>
  );
}
