"""
FastAPI main application
"""
import os
import traceback
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api.routes import router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Transactions Dashboard API",
    description="API for analyzing credit card transactions",
    version="1.0.0"
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Global exception: %s", exc)
    logger.error(traceback.format_exc())
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )
    # Ensure CORS header is present so the browser can read the error response
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    return response

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes (registered first so /api/* always takes priority)
app.include_router(router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "healthy"}

# ── Production: serve the compiled React SPA ─────────────────────────────────
# The Dockerfile copies frontend/dist → ./static
# Try one level up first (Docker: /app/app/main.py → /app/static),
# then two levels up (dev: backend/app/main.py → ../../static).
_base = os.path.dirname(__file__)
STATIC_DIR = os.path.normpath(os.path.join(_base, "..", "static"))
if not os.path.isdir(STATIC_DIR):
    STATIC_DIR = os.path.normpath(os.path.join(_base, "..", "..", "static"))
if not os.path.isdir(STATIC_DIR):
    STATIC_DIR = os.path.normpath(os.path.join(_base, "..", "..", "frontend", "dist"))

if os.path.isdir(STATIC_DIR):
    logger.info("Serving SPA from STATIC_DIR=%s", STATIC_DIR)

    # Serve hashed asset files (JS/CSS bundles) with long-lived cache
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    _STATIC_ROOT = os.path.realpath(STATIC_DIR)

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve static file if it exists, otherwise return index.html for SPA routing."""
        index = os.path.join(_STATIC_ROOT, "index.html")
        if not full_path:
            return FileResponse(index)
        # Resolve and confine to STATIC_DIR to block path traversal (e.g. ../../etc/passwd)
        candidate = os.path.realpath(os.path.join(_STATIC_ROOT, full_path))
        if (
            (candidate == _STATIC_ROOT or candidate.startswith(_STATIC_ROOT + os.sep))
            and os.path.isfile(candidate)
        ):
            return FileResponse(candidate)
        return FileResponse(index)
else:
    logger.warning("STATIC_DIR=%s not found — SPA catch-all disabled", STATIC_DIR)

    @app.get("/")
    async def root():
        return {"message": "Transactions Dashboard API", "version": "1.0.0"}
