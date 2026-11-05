import Link from "next/link";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[720px]">
      <div className="label-mono text-ink-2">Last updated {updated}</div>
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="mt-3 rounded-md bg-engine-tint/60 px-3 py-2 text-sm text-engine">
        Plain-language draft written from how Argumenté actually works. Have a lawyer review it, and fill in the operator’s name and contact,
        before you invite people who aren’t friends.
      </p>
      <div className="prose-body mt-6 space-y-5 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">{children}</div>
      <p className="mt-10 text-sm text-ink-2">
        <Link href="/privacy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link>
      </p>
    </article>
  );
}
