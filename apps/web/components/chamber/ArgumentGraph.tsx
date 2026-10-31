"use client";

import { useMemo, useState } from "react";

/** Interactive argument graph (plain SVG, no layout library).
 *
 *  Layout, top to bottom:
 *    shared ground  →  typed differences  →  people  →  each person's crux, claims, interests, assumptions
 *  Edges link each difference to the people it involves. Hovering or focusing a node highlights its
 *  connections. Only ENDORSED claims are drawn as a person's words (solid); everything the Mediator
 *  inferred is drawn dashed and labelled (invariant 3).
 */

type Node = {
  id: string;
  kind: string;
  claim_type?: string | null;
  text: string;
  holder_id?: string | null;
  epistemic_status: string;
  party_ids: string[];
};
type Person = { user_id: string; name: string };
type Crux = { id: string; party_id: string; text: string; confirmed: boolean | null };

const COL_W = 250;
const GAP = 36;
const PAD = 24;
const LINE_H = 16;
const CHARS = 34;

const TYPE_COLOR: Record<string, string> = {
  FACT: "#0B7285",
  VALUE: "#5F3DC4",
  INTEREST: "#2B8A3E",
  INTERPRETATION: "#7A5F30",
  PREDICTION: "#364FC7",
  DEFINITION: "#A61E4D",
  POLICY: "#495057",
};

function wrap(text: string, max = CHARS, maxLines = 5): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] += "…";
  return lines;
}

type Box = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  label: string;
  color: string;
  dashed: boolean;
  fill: string;
  links: string[];
  kind: string;
};

export function ArgumentGraph({ nodes, people, cruxes }: { nodes: Node[]; people: Person[]; cruxes: Crux[] }) {
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const boxes: Box[] = [];
    const nCols = Math.max(people.length, 1);
    const width = Math.max(nCols * COL_W + (nCols - 1) * GAP + PAD * 2, 640);
    const colX = (i: number) => PAD + i * (COL_W + GAP) + (width - PAD * 2 - (nCols * COL_W + (nCols - 1) * GAP)) / 2;
    let y = PAD;

    // Shared ground (spanning)
    const shared = nodes.filter((n) => n.kind === "VALUE");
    if (shared.length) {
      const lines = wrap(shared.map((n) => n.text).join("  ·  "), Math.floor((width - PAD * 2) / 7.2), 3);
      const h = 22 + lines.length * LINE_H + 10;
      boxes.push({ id: "shared", x: PAD, y, w: width - PAD * 2, h, lines, label: "SHARED GROUND", color: "#27694B", dashed: true, fill: "#E6F1EB", links: [], kind: "VALUE" });
      y += h + 22;
    }

    // Differences, laid out in a row (wrapping onto more rows if needed)
    const diffs = nodes.filter((n) => n.kind === "DISAGREEMENT");
    if (diffs.length) {
      const perRow = Math.max(1, Math.floor((width - PAD * 2 + GAP) / (220 + GAP)));
      let rowH = 0;
      diffs.forEach((d, i) => {
        const col = i % perRow;
        if (col === 0 && i > 0) {
          y += rowH + 16;
          rowH = 0;
        }
        const rowCount = Math.min(perRow, diffs.length - Math.floor(i / perRow) * perRow);
        const rowW = rowCount * 220 + (rowCount - 1) * GAP;
        const x = (width - rowW) / 2 + col * (220 + GAP);
        const lines = wrap(d.text, 30, 4);
        const h = 22 + lines.length * LINE_H + 10;
        rowH = Math.max(rowH, h);
        boxes.push({
          id: d.id,
          x,
          y,
          w: 220,
          h,
          lines,
          label: d.claim_type ?? "DIFFERENCE",
          color: TYPE_COLOR[d.claim_type ?? ""] ?? "#495057",
          dashed: true,
          fill: "#FFFFFF",
          links: d.party_ids.map((p) => `person:${p}`),
          kind: "DISAGREEMENT",
        });
      });
      y += rowH + 56;
    }

    // People headers and columns
    const headerY = y;
    let maxBottom = y;
    people.forEach((p, i) => {
      const x = colX(i);
      boxes.push({ id: `person:${p.user_id}`, x, y: headerY, w: COL_W, h: 40, lines: [p.name], label: "", color: "#1A1A1A", dashed: false, fill: "#1A1A1A", links: [], kind: "PERSON" });
      let cy = headerY + 40 + 14;
      const add = (id: string, text: string, label: string, color: string, dashed: boolean, fill: string, kind: string) => {
        const lines = wrap(text);
        const h = 22 + lines.length * LINE_H + 10;
        boxes.push({ id, x, y: cy, w: COL_W, h, lines, label, color, dashed, fill, links: [`person:${p.user_id}`], kind });
        cy += h + 10;
      };
      cruxes
        .filter((c) => c.party_id === p.user_id && c.confirmed !== false)
        .forEach((c) => add(c.id, c.text, c.confirmed ? "◆ CRUX · CONFIRMED" : "◆ CRUX · UNCONFIRMED", "#C2410C", !c.confirmed, "#FFF4ED", "CRUX"));
      nodes
        .filter((n) => n.kind === "CLAIM" && n.holder_id === p.user_id)
        .forEach((n) =>
          add(
            n.id,
            n.text,
            `${n.claim_type ?? "CLAIM"} · ${n.epistemic_status === "ENDORSED" ? "IN THEIR WORDS" : "MEDIATOR'S READING"}`,
            TYPE_COLOR[n.claim_type ?? ""] ?? "#495057",
            n.epistemic_status !== "ENDORSED",
            "#FFFFFF",
            "CLAIM",
          ),
        );
      nodes
        .filter((n) => (n.kind === "INTEREST" || n.kind === "ASSUMPTION") && n.holder_id === p.user_id)
        .forEach((n) => add(n.id, n.text, `${n.kind} · INFERRED`, "#7A5F30", true, "#F3ECE0", n.kind));
      maxBottom = Math.max(maxBottom, cy);
    });
    return { boxes, width, height: maxBottom + PAD };
  }, [nodes, people, cruxes]);

  const byId = Object.fromEntries(layout.boxes.map((b) => [b.id, b]));
  const related = (b: Box) => (hover ? b.id === hover || b.links.includes(hover) || (byId[hover]?.links ?? []).includes(b.id) : true);

  // Edges: differences → people (curved), column items hang from their person (straight, subtle)
  const edges: { d: string; from: string; to: string; strong: boolean; color: string }[] = [];
  for (const b of layout.boxes) {
    for (const l of b.links) {
      const t = byId[l];
      if (!t) continue;
      if (b.kind === "DISAGREEMENT") {
        const x1 = b.x + b.w / 2;
        const y1 = b.y + b.h;
        const x2 = t.x + t.w / 2;
        const y2 = t.y;
        const my = (y1 + y2) / 2;
        edges.push({ d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`, from: b.id, to: t.id, strong: true, color: b.color });
      }
    }
  }

  if (!nodes.length) return <p className="text-sm text-ink-2">The argument graph appears once the Mediator has read everyone’s positions.</p>;

  return (
    <figure className="overflow-x-auto rounded-lg border hairline bg-white/60">
      <svg
        role="img"
        aria-label="Argument graph: shared ground, typed differences, and each person's claims, interests and assumptions"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="mx-auto block"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {edges.map((e, i) => {
          const on = !hover || e.from === hover || e.to === hover;
          return <path key={i} d={e.d} fill="none" stroke={e.color} strokeWidth={on && hover ? 2.5 : 1.5} opacity={on ? 0.75 : 0.12} strokeDasharray="4 3" />;
        })}
        {layout.boxes.map((b) => {
          const on = related(b);
          const isPerson = b.kind === "PERSON";
          return (
            <g
              key={b.id}
              tabIndex={0}
              onMouseEnter={() => setHover(b.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(b.id)}
              onBlur={() => setHover(null)}
              opacity={on ? 1 : 0.25}
              style={{ cursor: "default", outline: "none" }}
            >
              <title>{[b.label, b.lines.join(" ")].filter(Boolean).join(": ")}</title>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={isPerson ? 20 : 8}
                fill={b.fill}
                stroke={b.color}
                strokeWidth={hover === b.id ? 2.2 : 1.2}
                strokeDasharray={b.dashed ? "5 3" : undefined}
              />
              {isPerson ? (
                <text x={b.x + b.w / 2} y={b.y + 25} textAnchor="middle" fill="#F7F4EE" fontSize={15} fontWeight={600} fontFamily="var(--font-ui)">
                  {b.lines[0]}
                </text>
              ) : (
                <>
                  <text x={b.x + 10} y={b.y + 16} fill={b.color} fontSize={9.5} letterSpacing="0.06em" fontFamily="var(--font-mono)">
                    {b.label}
                  </text>
                  {b.lines.map((l, i) => (
                    <text key={i} x={b.x + 10} y={b.y + 34 + i * LINE_H} fill="#1A1A1A" fontSize={13}>
                      {l}
                    </text>
                  ))}
                </>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 border-t hairline px-4 py-2 text-xs text-ink-2">
        <span>Solid border: the person’s own endorsed words</span>
        <span>Dashed: the Mediator’s reading or inference</span>
        <span className="text-crux">◆ Crux: what would change their mind</span>
        <span>Hover or tab to a node to trace its links</span>
      </figcaption>
    </figure>
  );
}
