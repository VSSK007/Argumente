"use client";

import Link from "next/link";
import { api, useMe, usePoll } from "@/lib/api";
import { Button, Card } from "@/components/ui";

export default function Inbox() {
  const { me } = useMe();
  const { data, reload } = usePoll<any>(me ? "/notifications" : null, 15000);
  if (!me || !data) return null;
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-mono text-ink-2">Inbox</div>
          <h1 className="font-display text-4xl">What needs you</h1>
        </div>
        {data.unread ? (
          <Button
            variant="quiet"
            onClick={async () => {
              await api("/notifications/read", { body: {} });
              reload();
            }}
          >
            Mark all read
          </Button>
        ) : null}
      </div>
      <ul className="mt-6 divide-y hairline border-y hairline">
        {data.items.map((n: any) => (
          <li key={n.id}>
            <Link
              href={n.link ?? "/"}
              onClick={() => api("/notifications/read", { body: { ids: [n.id] } }).catch(() => null)}
              className="flex items-start gap-3 py-3 hover:bg-white/60"
            >
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-delegate"}`} aria-label={n.read ? "read" : "unread"} />
              <span className="flex-1">
                <span className={`block ${n.read ? "" : "font-medium"}`}>{n.title}</span>
                <span className="block text-sm text-ink-2">{n.body}</span>
              </span>
              <time className="shrink-0 font-mono text-xs text-ink-2" dateTime={n.at}>
                {new Date(n.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </time>
            </Link>
          </li>
        ))}
        {!data.items.length ? <li className="py-4 text-ink-2">Nothing yet. You’ll see nudges here when it’s your turn in a Chamber.</li> : null}
      </ul>
      <Card className="mt-8 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={data.email}
            onChange={async (e) => {
              await api("/me/notification-settings", { method: "PATCH", body: { email: e.target.checked } });
              reload();
            }}
          />
          <span>
            Also email me when something needs me
            <span className="block text-xs text-ink-2">At most one email every 30 minutes. Emails say what to do, never what anyone wrote.</span>
          </span>
        </label>
      </Card>
    </div>
  );
}
