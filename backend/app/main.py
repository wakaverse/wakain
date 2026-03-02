from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ALLOWED_ORIGINS
from app.routes import analyze, jobs, library, radar, waitlist

app = FastAPI(title="WakaIn API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(waitlist.router, prefix="/api")
app.include_router(radar.router, prefix="/api")
app.include_router(library.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
