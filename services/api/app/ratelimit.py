"""In-memory sliding-window rate limits (per user, per bucket).

Keeps Mediator/LLM spend and spam bounded. Single-process only; a deployed version would use Redis.
"""

import os
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException

LIMITS = {
    # bucket: (max actions, window seconds)
    "engine": (int(os.environ.get("RATE_LIMIT_ENGINE_PER_HOUR", "120")), 3600),
    "create": (int(os.environ.get("RATE_LIMIT_CREATE_PER_HOUR", "30")), 3600),
    "auth": (int(os.environ.get("RATE_LIMIT_AUTH_PER_HOUR", "5")), 3600),
}

_hits: dict[tuple[str, str], deque] = defaultdict(deque)
_lock = threading.Lock()


def check(user_id: str, bucket: str):
    limit, window = LIMITS[bucket]
    t = time.time()
    with _lock:
        q = _hits[(user_id, bucket)]
        while q and q[0] <= t - window:
            q.popleft()
        if len(q) >= limit:
            wait = int(q[0] + window - t) + 1
            raise HTTPException(
                429,
                {"code": "RATE_LIMITED", "message": f"You've done that a lot in the last hour. Try again in about {max(1, wait // 60)} minute(s)."},
            )
        q.append(t)


def reset():
    with _lock:
        _hits.clear()
