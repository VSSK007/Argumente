import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import retention
from .db import ensure_schema
from .routers import admin, auth, chambers, delegates, public, spar, topics, understanding

logging.basicConfig(level=logging.INFO)

ensure_schema()
if os.environ.get("ENGINE_SYNC") != "1":
    retention.start_worker()

app = FastAPI(title="Argumenté API", version="0.1.0", description="Local MVP. See docs/SYSTEM_ARCHITECTURE.md.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, delegates.router, chambers.router, spar.router, public.router, understanding.router, topics.router, admin.router):
    app.include_router(r, prefix="/api/v1")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/.well-known/argumente-keys.json")
def well_known_keys():
    """Public keys for verifying Delegate Mandates."""
    from . import mandate
    from .db import SessionLocal

    with SessionLocal() as db:
        return mandate.jwks(db)
