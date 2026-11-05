"""Opinion landscape for public topics (Polis-style), in pure Python.

1. Vote matrix: participants (with at least MIN_VOTES votes) x active statements; agree=1, disagree=-1,
   pass=0; missing votes are imputed with the statement's mean so they don't pull anyone anywhere.
2. PCA to 2-D (power iteration on the covariance matrix).
3. k-means (k = 2..4, deterministic init), keeping the best silhouette among clusterings whose
   every group has at least MIN_GROUP people. Smaller groups are never shown: a group's agreement
   rates would otherwise reveal individual votes.
4. Per statement: agreement within each group, what distinguishes each group, cross-group
   consensus, and what divides groups.
Everything returned is aggregate and anonymous; a caller only learns their own group.
"""

import math
import random

MIN_VOTES = 3
MIN_GROUP = 3
CONSENSUS = 0.6
DIVISIVE = 0.5


def _mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def _pca2(rows: list[list[float]]) -> list[tuple[float, float]]:
    n, m = len(rows), len(rows[0])
    means = [_mean([r[j] for r in rows]) for j in range(m)]
    x = [[r[j] - means[j] for j in range(m)] for r in rows]
    cov = [[sum(x[i][a] * x[i][b] for i in range(n)) / max(n - 1, 1) for b in range(m)] for a in range(m)]
    comps = []
    for c in range(min(2, m)):
        v = [1.0 / math.sqrt(m) + 0.01 * ((j * 7 + c * 3) % 5) for j in range(m)]
        for _ in range(200):
            w = [sum(cov[a][b] * v[b] for b in range(m)) for a in range(m)]
            for p in comps:  # deflate against earlier components
                d = sum(w[k] * p[k] for k in range(m))
                w = [w[k] - d * p[k] for k in range(m)]
            norm = math.sqrt(sum(t * t for t in w)) or 1.0
            v = [t / norm for t in w]
        comps.append(v)
    while len(comps) < 2:
        comps.append([0.0] * m)
    return [(sum(r[k] * comps[0][k] for k in range(m)), sum(r[k] * comps[1][k] for k in range(m))) for r in x]


def _dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _kmeans(pts, k, seed=7):
    rnd = random.Random(seed)
    centers = [pts[rnd.randrange(len(pts))]]
    while len(centers) < k:  # k-means++ (deterministic seed)
        d2 = [min(_dist(p, c) ** 2 for c in centers) for p in pts]
        total = sum(d2) or 1.0
        r, acc = rnd.random() * total, 0.0
        for p, w in zip(pts, d2):
            acc += w
            if acc >= r:
                centers.append(p)
                break
        else:
            centers.append(pts[-1])
    labels = [0] * len(pts)
    for _ in range(50):
        labels = [min(range(k), key=lambda c: _dist(p, centers[c])) for p in pts]
        new = []
        for c in range(k):
            mem = [p for p, lab in zip(pts, labels) if lab == c]
            new.append((_mean([p[0] for p in mem]), _mean([p[1] for p in mem])) if mem else centers[c])
        if new == centers:
            break
        centers = new
    return labels


def _silhouette(pts, labels, k):
    s = []
    for i, p in enumerate(pts):
        same = [_dist(p, q) for j, q in enumerate(pts) if labels[j] == labels[i] and j != i]
        if not same:
            s.append(0.0)
            continue
        a = _mean(same)
        b = min(_mean([_dist(p, q) for j, q in enumerate(pts) if labels[j] == c]) for c in range(k) if c != labels[i] and labels.count(c))
        s.append((b - a) / max(a, b) if max(a, b) > 0 else 0.0)
    return _mean(s)


def analyze(statement_ids: list[str], votes: list[tuple[str, str, int]], me: str | None = None) -> dict:
    """votes: (user_id, statement_id, vote). Returns anonymous aggregates."""
    by_user: dict[str, dict[str, int]] = {}
    for u, s, v in votes:
        by_user.setdefault(u, {})[s] = v
    sids = [s for s in statement_ids if any(s in d for d in by_user.values())]
    people = [u for u, d in by_user.items() if len(d) >= MIN_VOTES]

    stats = {
        s: {
            "agree": sum(1 for d in by_user.values() if d.get(s) == 1),
            "disagree": sum(1 for d in by_user.values() if d.get(s) == -1),
            "pass": sum(1 for d in by_user.values() if d.get(s) == 0),
        }
        for s in statement_ids
    }
    out = {"participants": len(by_user), "mapped": 0, "points": [], "groups": [], "consensus": [], "divisive": [], "stats": stats, "my_group": None}
    if len(people) < 2 * MIN_GROUP or len(sids) < 2:
        return out

    col_mean = {s: _mean([by_user[u][s] for u in people if s in by_user[u]]) for s in sids}
    rows = [[by_user[u].get(s, col_mean[s]) for s in sids] for u in people]
    pts = _pca2(rows)
    scale = max(max(abs(x), abs(y)) for x, y in pts) or 1.0
    pts = [(x / scale, y / scale) for x, y in pts]

    best = None
    for k in range(2, min(4, len(people) // MIN_GROUP) + 1):
        labels = _kmeans(pts, k)
        sizes = [labels.count(c) for c in range(k)]
        if min(sizes) < MIN_GROUP:
            continue
        sil = _silhouette(pts, labels, k)
        if best is None or sil > best[0] + 0.02:
            best = (sil, k, labels)

    out["mapped"] = len(people)
    if best is None:
        out["points"] = [{"x": round(x, 3), "y": round(y, 3), "group": None, "me": u == me} for u, (x, y) in zip(people, pts)]
        return out
    _, k, labels = best
    # Stable group lettering: biggest group first
    order = sorted(range(k), key=lambda c: -labels.count(c))
    letter = {c: chr(ord("A") + i) for i, c in enumerate(order)}
    members = {letter[c]: [u for u, lab in zip(people, labels) if lab == c] for c in range(k)}
    out["points"] = [{"x": round(x, 3), "y": round(y, 3), "group": letter[lab], "me": u == me} for u, (x, y), lab in zip(people, pts, labels)]

    def agree_rate(users, s):
        vs = [by_user[u][s] for u in users if s in by_user[u]]
        return (sum(1 for v in vs if v == 1) / len(vs), len(vs)) if vs else (None, 0)

    rates = {g: {s: agree_rate(us, s) for s in sids} for g, us in members.items()}
    for g in sorted(members):
        others = [u for h, us in members.items() if h != g for u in us]
        rep = []
        for s in sids:
            a, n = rates[g][s]
            b, m = agree_rate(others, s)
            if a is None or b is None or n < 2 or m < 2:
                continue
            rep.append({"statement_id": s, "agree": round(a, 2), "others_agree": round(b, 2), "diff": round(a - b, 2)})
        rep.sort(key=lambda r: -abs(r["diff"]))
        out["groups"].append({"label": g, "size": len(members[g]), "distinctive": [r for r in rep if abs(r["diff"]) >= 0.3][:3]})

    for s in sids:
        rs = [rates[g][s] for g in members]
        if any(r[0] is None or r[1] < 2 for r in rs):
            continue
        vals = [r[0] for r in rs]
        if min(vals) >= CONSENSUS:
            out["consensus"].append({"statement_id": s, "min_group_agree": round(min(vals), 2)})
        if max(vals) - min(vals) >= DIVISIVE:
            out["divisive"].append({"statement_id": s, "spread": round(max(vals) - min(vals), 2), "by_group": {g: round(rates[g][s][0], 2) for g in sorted(members)}})
    out["consensus"].sort(key=lambda r: -r["min_group_agree"])
    out["divisive"].sort(key=lambda r: -r["spread"])
    if me:
        out["my_group"] = next((g for g, us in members.items() if me in us), None)
    return out
