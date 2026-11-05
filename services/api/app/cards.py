"""Onboarding position cards (PERSONA_ARCHITECTURE.md §3). Each answer becomes an ENDORSED position."""

CARDS = {
    "general": [
        {"id": "g1", "topic": "money", "text": "Splitting shared costs equally is fair even when incomes differ."},
        {"id": "g2", "topic": "decisions", "text": "Group decisions should be made by majority vote."},
        {"id": "g3", "topic": "time", "text": "Plans made in advance should only change if everyone agrees."},
        {"id": "g4", "topic": "conflict", "text": "It's better to raise a problem immediately than to wait for the right moment."},
        {"id": "g5", "topic": "fairness", "text": "Whoever cares most about an outcome should get more say in it."},
        {"id": "g6", "topic": "home", "text": "Chores should be split by time spent, not by number of tasks."},
        {"id": "g7", "topic": "travel", "text": "On a group trip, rest matters more than seeing everything."},
        {"id": "g8", "topic": "honesty", "text": "Being direct is kinder than being diplomatic."},
        {"id": "g9", "topic": "money", "text": "People who earn more should pay a bigger share of group costs."},
        {"id": "g10", "topic": "decisions", "text": "A decision everyone can live with beats the best decision some people resent."},
    ],
}

TEMPLATES = {
    "decision": {
        "label": "Decision",
        "description": "A shared choice: a trip, a purchase, a plan.",
        "prompt": "What should we decide, and what matters to you about it?",
    },
    "disagreement": {
        "label": "Disagreement",
        "description": "Two or more people see something differently.",
        "prompt": "What's your view, and why do you hold it?",
    },
    "household": {
        "label": "Household",
        "description": "Chores, bills, guests, noise. Living together.",
        "prompt": "What's working, what isn't, and what would feel fair to you?",
    },
}
