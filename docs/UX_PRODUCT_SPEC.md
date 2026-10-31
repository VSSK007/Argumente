# UX & Product Spec

## 1. Design thesis

**"An editorial publication about two minds."** Argumenté should feel closer to a well-set magazine, or a legal brief someone made beautiful, than to a chat app or a SaaS dashboard. Disagreement is presented as something worth reading carefully.

## 2. Information architecture

```text
Home (Today)
 ├─ Your Chambers (active · needs you · closed)
 ├─ Start: Decision · Disagreement · Household · Spar
 └─ From the Commons (published Maps, lightweight)
Chamber
 ├─ Brief (topic, members, state rail, pause)
 ├─ My Position (intake / Delegate draft / endorse)
 ├─ Restatements (gate)
 ├─ Understanding Map
 ├─ Options & Agreement
 └─ Record (event timeline)
Spar (solo)
Commons (public Maps, topics [v1], profiles [v1])
Me
 ├─ My Delegate (identity, voice, methodology, autonomy)
 ├─ Memory Inspector (positions, scopes, history)
 ├─ Agreements
 └─ Settings · Privacy · Export · Delete
```

Navigation: mobile has a 4-tab bottom bar (Today, Chambers, Commons, Me). Desktop has a left rail plus a centered reading column (max 720px), with a right "margin" column for annotations (cruxes, labels).

## 3. Visual system

### 3.1 Typography (the primary design material)
- **Display / headings:** a high-contrast serif. *Fraunces* (variable, open license) or *Newsreader*.
- **Body:** *Source Serif 4* for long reading in Maps. *Inter* for UI chrome.
- **Mono (labels, epistemic tags):** *JetBrains Mono* or *IBM Plex Mono*, small caps, tracked +4%.
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / 56. Body is 17px on mobile and 18px on desktop, line-height 1.55.

### 3.2 Color
Paper-and-ink base. Restrained, no gradient washes.

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | #F7F4EE | #121212 | background |
| `ink` | #1A1A1A | #ECE8E1 | text |
| `rule` | #D9D3C7 | #2C2C2C | hairlines |
| `human` | ink, solid | | Human-authored content: solid ink, no tint |
| `delegate` | #3B5BDB at 8% tint + 2px left rule | | Delegate content |
| `engine` | #8A6D3B (ochre) | | Mediator/engine content: italic serif |
| `crux` | #C2410C (vermilion) | | Crux markers only. Scarcity gives it meaning. |
| `agree` | #2F7D5B | | Shared ground |

Party colors in a Chamber come from a muted categorical set (slate, plum, teal, sand, moss). They identify, they don't rank, and they're never red versus green.

### 3.3 The identity grammar (human vs AI, the most important pattern)

| | Human | Delegate | Mediator (engine) |
|---|---|---|---|
| Avatar | Photo or initials, circle | **Generated geometric glyph, rounded square**, with the owner's initials in a corner badge | A single ochre "§" mark |
| Name line | `Alice` | `Juniper · Delegate of Alice ✓` | `Mediator` |
| Text | Roman serif, ink | Roman serif on a delegate tint with a left rule | *Italic* serif, ochre rule |
| Tag | — | Epistemic tag: `ENDORSED` / `INFERRED` / `DRAFT` | `ANALYSIS · confidence 0.7` |

Shape (circle vs rounded square) plus text treatment means it stays distinguishable in grayscale and for color-blind users.

### 3.4 Components
`DelegateBadge`, `EpistemicTag`, `PositionCard` (swipe: agree/disagree/depends + why), `StateRail` (horizontal protocol progress: Framing → Intake → Decompose → Restate → Map → Resolve → Close), `RestatementCard` (accept / "not quite" + feedback), `CruxMarker`, `DisagreementTypeChip` (FACT/VALUE/INTEREST/INTERPRETATION/PREDICTION/DEFINITION), `InterpretationDiff` (two columns with a shared observations band in the middle), `ApprovalRow` (per-person approval states, never pre-checked), `PauseButton` (always in the header), `EngineThinking` (typeset "the Mediator is reading…" with a progress list of steps, not a spinner).

## 4. Main screens

1. **Onboarding / Delegate creation:** a 3-step editorial flow. (a) "Who represents you?" Name the Delegate and generate a glyph. (b) Voice sliders (Direct ↔ Diplomatic, Brief ↔ Thorough, Dry ↔ Warm) and a methodology choice with one-line descriptions. (c) 6–10 position cards. The end screen shows "Your Delegate knows 8 things about you. Nothing else." It's an explicit statement of scope.
2. **Today:** "Needs you" cards ("Bob's restatement of your view is ready. Is it right?"). No infinite feed.
3. **Chamber, Intake:** a private composer with "Draft with my Delegate." The draft appears tinted. Endorse or edit, and edits turn it into human ink.
4. **Chamber, Restatements:** one card per party. "Here's how the Mediator explained *your* view to the group. Is this you?" Accept or Not quite.
5. **Understanding Map (signature screen):** a long-form editorial page.
   - Headline: the question.
   - *Where you stand*: one column per party (endorsed only).
   - *What you share*: values and observations (green rule).
   - *Where you differ*: grouped by disagreement type, each with a one-line explanation of why the type matters ("This is a VALUE difference. More facts won't resolve it.").
   - *Cruxes*: vermilion markers.
   - *Open questions*: discussion prompts.
   - Footer: "Understood – still disagree" or "Explore options."
   - Desktop: margin notes for assumptions. Mobile: tap-to-expand.
6. **Options & Agreement:** private ranking (drag) → a chosen option → an Agreement with per-item approval rows.
7. **Spar:** the claim at the top, a timeline of rounds, the opponent glyph labeled with its methodology, and a closing "robustness report."
8. **Debate timeline [v1]:** a horizontal argument-graph view. Claims are nodes, attacks are angled connectors, and you can scrub through time.
9. **Commons:** a typographic index of published Maps ("Should housemates split rent by room size?": 3 positions, 2 cruxes). No like counts. "I learned something" is the only reaction.
10. **Memory Inspector:** a table-like list of positions with scope chips and history drawers.

## 5. Interaction principles
- **Slowness as a feature:** the protocol has clear stages. Every engine step shows its work.
- **No hostility gamification:** no win counts, no "destroyed" moments, no flames. Reputation comes from steelmen accepted and minds changed.
- **Correction is the main gesture:** "Not quite" is as prominent as "Accept."
- **Interruptibility:** Pause is always visible, and its state is broadcast.

## 6. Accessibility
WCAG 2.2 AA contrast. Identity isn't conveyed by color alone (shape plus label). Reduced motion respected. Screen-reader labels include the epistemic status ("Delegate of Alice, inferred, not confirmed").

## 7. Tailwind 4 tokens (starter)

```css
@theme {
  --color-paper: #F7F4EE; --color-ink: #1A1A1A; --color-rule: #D9D3C7;
  --color-delegate: #3B5BDB; --color-engine: #8A6D3B; --color-crux: #C2410C; --color-agree: #2F7D5B;
  --font-display: "Fraunces", serif; --font-body: "Source Serif 4", serif;
  --font-ui: "Inter", sans-serif; --font-mono: "JetBrains Mono", monospace;
  --radius-delegate: 0.625rem;
}
```
