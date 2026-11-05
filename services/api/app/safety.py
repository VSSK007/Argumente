"""Trust & Safety checks (local MVP version). See docs/TRUST_AND_SAFETY.md.

- Risk screening on participant text: abuse, coercive control, self-harm. On a hit, the affected
  user privately gets resources and the Chamber pauses quietly (the other party is not told why).
- Output check: Delegates/Mediator must never write as if they were the human ("I, Alice").
"""

import re

RISK_PATTERNS: dict[str, list[str]] = {
    "self_harm": [r"\bkill myself\b", r"\bsuicid", r"\bend my life\b", r"\bself[- ]harm\b", r"\bhurt myself\b"],
    "violence": [r"\b(hits|hit|beats|beat|chokes|choked|pushed|shoved|slapped) me\b", r"\bthreaten(s|ed)? (to )?(hurt|kill)", r"\bafraid (of|for) (him|her|them|my life)\b", r"\bscared of (him|her|them)\b"],
    "coercive_control": [r"\bnot allowed to\b", r"\b(checks|reads|monitors|tracks) my (phone|messages|location)\b", r"\btakes? my (money|wages|card)\b", r"\bwon't let me (see|leave|go|work)\b", r"\bisolat(es|ing) me\b"],
}

RESOURCES = {
    "summary": "You're not alone, and this isn't something you have to mediate. Talking to someone trained can help.",
    "links": [
        {"label": "If you're in immediate danger, call your local emergency number (911 / 999 / 112).", "url": None},
        {"label": "Find a helpline in your country (findahelpline.com)", "url": "https://findahelpline.com"},
        {"label": "US National Domestic Violence Hotline: 1-800-799-7233", "url": "https://www.thehotline.org"},
        {"label": "UK National Domestic Abuse Helpline: 0808 2000 247", "url": "https://www.nationaldahelpline.org.uk"},
        {"label": "US Suicide & Crisis Lifeline: call or text 988", "url": "https://988lifeline.org"},
    ],
}


def screen(text: str) -> str | None:
    low = (text or "").lower()
    for category, pats in RISK_PATTERNS.items():
        if any(re.search(p, low) for p in pats):
            return category
    return None


def check_output(text: str, human_names: list[str]) -> str:
    """Rewrite first-person impersonation like "I, Alice," into third person."""
    out = text
    for name in human_names:
        if not name:
            continue
        out = re.sub(rf"\bI,\s*{re.escape(name)}\b,?", f"{name}", out)
        out = re.sub(rf"\bAs {re.escape(name)},\s*I\b", f"{name}", out)
    return out
