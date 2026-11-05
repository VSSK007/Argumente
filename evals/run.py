"""Mediator eval harness (docs/ARGUMENTATIVE_INTELLIGENCE.md §5).

Runs every scenario through decompose -> restate -> render_map and scores:
  fabrication      quoted text (“…” or "…") that does not appear in any party's own words  (target: 0)
  misattribution   a party's restatement quoting another party's words                       (target: 0)
  coverage         share of parties with a restatement, at least one claim and a crux
  type_recall      share of expected disagreement types the engine found
  balance          shortest / longest restatement length (1.0 = perfectly even)

Usage (from services/api):
  uv run python ../../evals/run.py                  # uses the configured engine (offline unless ANTHROPIC_API_KEY is set)
  ENGINE_PROVIDER=local uv run python ../../evals/run.py
Writes evals/REPORT.md (latest) and evals/results/<provider>-<timestamp>.json.
"""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "services" / "api"))

from app.engine import engine_status, get_engine  # noqa: E402
from app.engine.types import Party  # noqa: E402

QUOTE = re.compile(r"[“\"]([^”\"]{6,})[”\"]")


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"\s+", " ", s.lower())).strip()


def quotes(text: str) -> list[str]:
    return [q.strip().rstrip(".") for q in QUOTE.findall(text or "")]


def score_scenario(sc: dict, engine) -> dict:
    parties = [Party(party_id=f"p{i}", label=p["label"], text=p["text"]) for i, p in enumerate(sc["parties"])]
    own = {p.party_id: norm(p.text) for p in parties}
    everyone = " ".join(own.values())
    modes = set()
    t0 = time.time()
    dec, m = engine.decompose(sc["question"], parties)
    modes.add(m)
    restatements = {}
    for p in parties:
        claims = [c.text for c in dec.claims if c.party_id == p.party_id]
        out, m = engine.restate(sc["question"], p, claims)
        modes.add(m)
        restatements[p.party_id] = out.text
    mp, m = engine.render_map(sc["question"], parties, dec)
    modes.add(m)
    elapsed = time.time() - t0

    fabricated, misattributed = [], []
    for pid, text in restatements.items():
        for q in quotes(text):
            nq = norm(q)
            if nq not in everyone:
                fabricated.append(q)
            elif nq not in own[pid]:
                misattributed.append(q)
    shared_text = " ".join([mp.summary, *mp.shared, *[d.summary for d in mp.differences]])
    fabricated += [q for q in quotes(shared_text) if norm(q) not in everyone]

    covered = sum(
        1
        for p in parties
        if restatements.get(p.party_id)
        and any(c.party_id == p.party_id for c in dec.claims)
        and any(c.party_id == p.party_id for c in dec.cruxes)
    )
    found = {d.type for d in dec.disagreements}
    expected = set(sc["expected_types"])
    lengths = [len(t) for t in restatements.values()] or [1]
    return {
        "id": sc["id"],
        "fabrication": len(fabricated),
        "fabricated_examples": fabricated[:3],
        "misattribution": len(misattributed),
        "coverage": covered / len(parties),
        "type_recall": len(found & expected) / len(expected) if expected else 1.0,
        "types_found": sorted(found),
        "balance": min(lengths) / max(lengths),
        "seconds": round(elapsed, 2),
        "modes": sorted(modes),
    }


def main() -> int:
    status = engine_status()
    engine = get_engine()
    scenarios = [json.loads(p.read_text()) for p in sorted((HERE / "scenarios").glob("*.json"))]
    rows = [score_scenario(sc, engine) for sc in scenarios]
    n = len(rows)
    summary = {
        "provider": status["provider"],
        "models": [status.get("analyze_model"), status.get("fast_model")],
        "scenarios": n,
        "fabrication_total": sum(r["fabrication"] for r in rows),
        "misattribution_total": sum(r["misattribution"] for r in rows),
        "coverage_avg": round(sum(r["coverage"] for r in rows) / n, 3),
        "type_recall_avg": round(sum(r["type_recall"] for r in rows) / n, 3),
        "balance_avg": round(sum(r["balance"] for r in rows) / n, 3),
        "seconds_total": round(sum(r["seconds"] for r in rows), 1),
        "fallbacks": sum(1 for r in rows if any(m != "anthropic" for m in r["modes"])) if status["provider"] == "anthropic" else None,
    }
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    (HERE / "results").mkdir(exist_ok=True)
    (HERE / "results" / f"{summary['provider']}-{stamp}.json").write_text(json.dumps({"summary": summary, "rows": rows}, indent=2))

    lines = [
        "# Mediator eval report",
        "",
        f"Run {stamp} · engine **{summary['provider']}**"
        + (f" ({', '.join(m for m in summary['models'] if m)})" if summary["provider"] == "anthropic" else ""),
        "",
        "| Metric | Value | Target |",
        "|---|---|---|",
        f"| Fabricated quotes | {summary['fabrication_total']} | 0 |",
        f"| Misattributed quotes | {summary['misattribution_total']} | 0 |",
        f"| Coverage (restatement + claim + crux per person) | {summary['coverage_avg']:.0%} | 100% |",
        f"| Disagreement-type recall | {summary['type_recall_avg']:.0%} | ≥ 70% |",
        f"| Restatement balance (short/long) | {summary['balance_avg']:.2f} | ≥ 0.5 |",
        f"| Total time | {summary['seconds_total']}s | — |",
    ]
    if summary["fallbacks"] is not None:
        lines.append(f"| Scenarios with an offline fallback | {summary['fallbacks']} | 0 |")
    lines += ["", "| Scenario | Fabr. | Misattr. | Coverage | Type recall | Types found | Balance | s |", "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        lines.append(
            f"| {r['id']} | {r['fabrication']} | {r['misattribution']} | {r['coverage']:.0%} | {r['type_recall']:.0%} | {', '.join(r['types_found'])} | {r['balance']:.2f} | {r['seconds']} |"
        )
    lines += [
        "",
        "Type recall is scored against hand-written expectations in `evals/scenarios/*.json` and is a rough guide, not ground truth.",
        "Representation fidelity as judged by the people themselves is measured live via restatement acceptance, not here.",
    ]
    (HERE / "REPORT.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:12]))
    return 1 if summary["fabrication_total"] or summary["misattribution_total"] else 0


if __name__ == "__main__":
    sys.exit(main())
