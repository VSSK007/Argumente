"""Regression gate: the Mediator must never fabricate or misattribute quotes (offline engine)."""

import importlib.util
from pathlib import Path

from app.engine import get_engine

RUN = Path(__file__).resolve().parents[3] / "evals" / "run.py"


def test_eval_scenarios_have_no_fabrication():
    spec = importlib.util.spec_from_file_location("evals_run", RUN)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    import json

    engine = get_engine()
    for path in sorted((RUN.parent / "scenarios").glob("*.json")):
        row = mod.score_scenario(json.loads(path.read_text()), engine)
        assert row["fabrication"] == 0, (row["id"], row["fabricated_examples"])
        assert row["misattribution"] == 0, row["id"]
        assert row["coverage"] == 1.0, row["id"]
