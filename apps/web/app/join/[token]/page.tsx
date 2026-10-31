"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, useMe } from "@/lib/api";
import { Button, Card, ErrorNote } from "@/components/ui";

export default function Join() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { me } = useMe();
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/invites/${token}`).then(setInvite).catch((e) => setError(e.message));
  }, [token]);

  async function join() {
    setError(null);
    try {
      const r = await api(`/invites/${token}/accept`, { body: {} });
      router.push(`/chambers/${r.chamber_id}`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="label-mono text-ink-2">You’re invited</div>
      {invite ? (
        <>
          <h1 className="font-display text-4xl">{invite.title}</h1>
          <p className="prose-body mt-2 text-ink-2">
            {invite.creator_name} wants your view on: <strong className="text-ink">{invite.question}</strong>
          </p>
          <Card className="mt-6 space-y-3 text-sm">
            <p>How it works:</p>
            <ol className="list-decimal space-y-1 pl-5 text-ink-2">
              <li>You write your position <strong>privately</strong>. Nobody sees it as you wrote it.</li>
              <li>A neutral AI Mediator explains each person’s view to the group, and you check that yours is right.</li>
              <li>You all see an Understanding Map of where you agree and where you really differ.</li>
            </ol>
            <p className="text-ink-2">You don’t need a Delegate to take part. You can create one later.</p>
            {!invite.open ? <p className="text-crux">This Chamber is past the intake stage.</p> : null}
            {me ? (
              <Button onClick={join} disabled={!invite.open} className="w-full">
                Join as {me.name}
              </Button>
            ) : (
              <Link href={`/login?next=/join/${token}`}>
                <Button className="w-full">Sign in to join</Button>
              </Link>
            )}
          </Card>
        </>
      ) : null}
      <ErrorNote error={error} />
    </div>
  );
}
