# Mediator eval report

Run 20261031T054839Z · engine **local**

| Metric | Value | Target |
|---|---|---|
| Fabricated quotes | 0 | 0 |
| Misattributed quotes | 0 | 0 |
| Coverage (restatement + claim + crux per person) | 100% | 100% |
| Disagreement-type recall | 88% | ≥ 70% |
| Restatement balance (short/long) | 0.76 | ≥ 0.5 |
| Total time | 0.0s | — |

| Scenario | Fabr. | Misattr. | Coverage | Type recall | Types found | Balance | s |
|---|---|---|---|---|---|---|---|
| chores_split | 0 | 0 | 100% | 100% | INTEREST, PREDICTION, VALUE | 0.65 | 0.0 |
| couple_attention | 0 | 0 | 100% | 100% | INTEREST, INTERPRETATION, VALUE | 0.74 | 0.0 |
| definition_fair | 0 | 0 | 100% | 50% | DEFINITION, INTEREST | 0.96 | 0.0 |
| family_holidays | 0 | 0 | 100% | 67% | INTEREST, VALUE | 0.53 | 0.0 |
| guests_policy | 0 | 0 | 100% | 100% | INTEREST, INTERPRETATION, VALUE | 0.93 | 0.0 |
| pet_adoption | 0 | 0 | 100% | 100% | INTEREST, PREDICTION | 0.55 | 0.0 |
| remote_work | 0 | 0 | 100% | 67% | FACT, PREDICTION | 0.89 | 0.0 |
| rent_by_room | 0 | 0 | 100% | 100% | INTEREST, VALUE | 0.78 | 0.0 |
| savings_vs_trip | 0 | 0 | 100% | 100% | INTEREST, INTERPRETATION, VALUE | 0.71 | 0.0 |
| trip_budget | 0 | 0 | 100% | 100% | INTEREST, INTERPRETATION, VALUE | 0.86 | 0.0 |

Type recall is scored against hand-written expectations in `evals/scenarios/*.json` and is a rough guide, not ground truth.
Representation fidelity as judged by the people themselves is measured live via restatement acceptance, not here.
