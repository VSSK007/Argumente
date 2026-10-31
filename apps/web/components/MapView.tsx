import { EpistemicTag, MediatorBadge, TypeChip } from "@/components/ui";

export type MapData = {
  headline: string;
  summary: string;
  stands: { label: string; text: string; written_by?: string }[];
  shared: string[];
  differences: { type: string; summary: string; why_type_matters: string }[];
  cruxes: { label: string; text: string; confirmed?: boolean | null }[];
  open_questions: string[];
};

/** The Understanding Map: the signature artifact (UX_PRODUCT_SPEC §4.5). */
export function MapView({ map, footer }: { map: MapData; footer?: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[720px]">
      <div className="label-mono text-ink-2">Understanding Map</div>
      <h1 className="mt-1 font-display text-4xl leading-tight md:text-5xl">{map.headline}</h1>
      <p className="prose-body mt-4 italic text-engine">{map.summary}</p>

      <section className="mt-10">
        <h2 className="label-mono border-b hairline pb-2 text-ink-2">Where each person stands</h2>
        <p className="mt-2 text-xs text-ink-2">Each person accepted this explanation of their own view.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {map.stands.map((s, i) => (
            <div key={i} className="rounded-lg border hairline bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg">{s.label}</span>
                <EpistemicTag status="ENDORSED" />
              </div>
              <p className="prose-body mt-2">{s.text}</p>
              {s.written_by === "human" ? <p className="mt-1 text-xs text-ink-2">Written by {s.label}.</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="label-mono border-b hairline pb-2 text-ink-2">What you share</h2>
        <ul className="mt-3 space-y-2">
          {map.shared.map((s, i) => (
            <li key={i} className="prose-body border-l-2 border-agree pl-3">
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="label-mono border-b hairline pb-2 text-ink-2">Where you differ</h2>
        <div className="mt-3 space-y-5">
          {map.differences.map((d, i) => (
            <div key={i}>
              <TypeChip type={d.type} />
              <p className="prose-body mt-1">{d.summary}</p>
              <p className="mt-1 text-sm italic text-ink-2">{d.why_type_matters}</p>
            </div>
          ))}
        </div>
      </section>

      {map.cruxes.length ? (
        <section className="mt-10">
          <h2 className="label-mono border-b hairline pb-2 text-crux">Cruxes</h2>
          <p className="mt-2 text-xs text-ink-2">The belief that, if it changed, would most likely change that person’s mind.</p>
          <ul className="mt-3 space-y-2">
            {map.cruxes.map((c, i) => (
              <li key={i} className="prose-body flex gap-2">
                <span className="text-crux" aria-hidden>
                  ◆
                </span>
                <span>
                  <strong className="font-semibold">{c.label}:</strong> {c.text}{" "}
                  <span className="label-mono text-ink-2">{c.confirmed ? "confirmed" : "unconfirmed"}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="label-mono border-b hairline pb-2 text-ink-2">Questions worth discussing</h2>
        <ol className="prose-body mt-3 list-decimal space-y-2 pl-5">
          {map.open_questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      </section>

      <div className="mt-10 flex items-center gap-2 border-t hairline pt-3 text-xs text-ink-2">
        <MediatorBadge /> drafted the analysis. The positions were confirmed by the people themselves.
      </div>
      {footer}
    </article>
  );
}
