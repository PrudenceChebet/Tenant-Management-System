"""
The same keyword rules the Node API uses when the AI service is down
(server/src/services/priority.js). Used here only as a baseline to compare
the model against. Keep the two lists in sync.
"""

HIGH_KEYWORDS = [
    "fire", "smoke", "burning", "gas", "flood", "flooding", "burst", "sewage",
    "spark", "sparks", "shock", "exposed wire", "live wire", "no water",
    "no power", "no electricity", "collapse", "collapsed", "cracked wall",
    "break-in", "broken into", "won't lock", "wont lock", "can't lock",
    "cannot lock", "locked out", "ceiling leak", "leaking from ceiling",
]

MEDIUM_KEYWORDS = [
    "leak", "leaking", "drip", "blocked", "clogged", "not working", "broken",
    "no hot water", "toilet", "socket", "lock", "window", "pest", "rats", "cockroach",
]

CATEGORY_DEFAULT = {
    "PLUMBING": "MEDIUM", "ELECTRICAL": "MEDIUM", "SECURITY": "MEDIUM",
    "STRUCTURAL": "MEDIUM", "PEST": "MEDIUM", "APPLIANCE": "LOW", "OTHER": "LOW",
}


def rule_priority(title, description, category):
    text = f"{title} {description}".lower()
    if any(k in text for k in HIGH_KEYWORDS):
        return "HIGH"
    if any(k in text for k in MEDIUM_KEYWORDS):
        return "MEDIUM"
    return CATEGORY_DEFAULT.get(category, "LOW")


def has_safety_keyword(title, description):
    """True if the text mentions danger (fire, gas, sparks, burst pipe...)."""
    text = f"{title} {description}".lower()
    return any(k in text for k in HIGH_KEYWORDS)
