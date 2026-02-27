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
    logger.error(f"Global exception: {str(exc)}")
    logger.error(traceback.format_exc())
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc), "traceback": traceback.format_exc()},
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

if os.path.isdir(STATIC_DIR):
    logger.info("Serving SPA from STATIC_DIR=%s", STATIC_DIR)

    # Serve hashed asset files (JS/CSS bundles) with long-lived cache
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve static file if it exists, otherwise return index.html for SPA routing."""
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
else:
    logger.warning("STATIC_DIR=%s not found — SPA catch-all disabled", STATIC_DIR)

    @app.get("/")
    async def root():
        return {"message": "Transactions Dashboard API", "version": "1.0.0"}
