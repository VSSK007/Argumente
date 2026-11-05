"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, setToken } from "@/lib/api";

/** Landing page for magic links. The token is in the URL fragment, so it never reaches server logs. */
export default function Verify() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    history.replaceState(null, "", window.location.pathname); // drop the token from the address bar
    if (!token) return setError("This sign-in link is incomplete.");
    api("/auth/magic-link/verify", { body: { token } })
      .then((r) => {
        setToken(r.token);
        const to = r.next || "/";
        router.replace(r.user.has_delegate || to.startsWith("/join") ? to : `/onboarding?next=${encodeURIComponent(to)}`);
      })
      .catch((e) => setError(e.message));
  }, [router]);
  return (
    <div className="mx-auto max-w-md" role="status">
      {error ? (
        <>
          <h1 className="font-display text-3xl">That link didn’t work</h1>
          <p className="mt-2 text-ink-2">{error}</p>
          <Link href="/login" className="mt-4 inline-block underline">
            Get a new sign-in link
          </Link>
        </>
      ) : (
        <h1 className="font-display text-3xl">Signing you in…</h1>
      )}
    </div>
  );
}
