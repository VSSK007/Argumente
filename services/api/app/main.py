import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from .routers import auth, chambers, delegates, public, spar

logging.basicConfig(level=logging.INFO)

Base.metadata.create_all(engine)

app = FastAPI(title="Argumenté API", version="0.1.0", description="Local MVP. See docs/SYSTEM_ARCHITECTURE.md.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, delegates.router, chambers.router, spar.router, public.router):
    app.include_router(r, prefix="/api/v1")


@app.get("/health")
def health():
    return {"ok": True}
