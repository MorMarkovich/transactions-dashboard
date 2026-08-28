"""
FastAPI main application
"""
import os
import logging
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api.routes import router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_is_render = os.environ.get("RENDER", "").lower() == "true"
app = FastAPI(
    title="Transactions Dashboard API",
    description="API for analyzing credit card transactions",
    version="1.0.0",
    # The schema is useful locally, but publishing the entire private API
    # surface in production provides attackers unnecessary reconnaissance.
    docs_url=None if _is_render else "/docs",
    redoc_url=None if _is_render else "/redoc",
    openapi_url=None if _is_render else "/openapi.json",
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled error on %s %s",
        request.method,
        request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


@app.middleware("http")
async def request_limits_and_security_headers(request: Request, call_next):
    # Reject oversized requests before multipart/JSON parsers allocate memory.
    content_length = request.headers.get("content-length")
    max_request_bytes = int(os.environ.get("MAX_REQUEST_BYTES", str(25 * 1024 * 1024)))
    if content_length:
        try:
            if int(content_length) > max_request_bytes:
                return JSONResponse(status_code=413, content={"detail": "Request body is too large"})
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header"})

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or ""
    parsed_supabase = urlsplit(supabase_url)
    supabase_origin = (
        f"{parsed_supabase.scheme}://{parsed_supabase.netloc}"
        if parsed_supabase.scheme in {"http", "https"} and parsed_supabase.netloc
        else ""
    )
    supabase_ws_origin = f"wss://{parsed_supabase.netloc}" if parsed_supabase.netloc else ""
    # The bank-sync companion binds only to this loopback origin and requires
    # both an allow-listed dashboard Origin and a keychain-backed token. Keep
    # the CSP exception exact so the dashboard cannot connect to arbitrary
    # LAN devices or other localhost ports.
    bank_sync_origin = "http://127.0.0.1:4000"
    connect_sources = " ".join(
        source
        for source in ["'self'", supabase_origin, supabase_ws_origin, bank_sync_origin]
        if source
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; "
        "script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; "
        f"connect-src {connect_sources}; worker-src 'self' blob:"
    )
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
    if _is_render:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# CORS middleware
_default_origins = (
    "https://transactions-dashboard-bfxn.onrender.com,"
    "http://localhost:5173,http://127.0.0.1:5173"
)
_allowed_origins = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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

class HashedStaticFiles(StaticFiles):
    """Vite asset filenames carry a content hash, so they can be cached forever;
    a new build references new filenames and old caches become irrelevant."""
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


if os.path.isdir(STATIC_DIR):
    logger.info("Serving SPA from STATIC_DIR=%s", STATIC_DIR)

    # Serve hashed asset files (JS/CSS bundles) with long-lived cache
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", HashedStaticFiles(directory=assets_dir), name="assets")

    # index.html (and other non-hashed files) must NEVER be heuristically
    # cached: without Cache-Control browsers reuse a stale index.html for
    # hours after a deploy, still referencing old bundle hashes — users only
    # see updates after a hard refresh. no-cache = revalidate via ETag (cheap
    # 304 when unchanged, fresh HTML right after a deploy).
    _NO_CACHE = {"Cache-Control": "no-cache"}

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve static file if it exists, otherwise return index.html for SPA routing."""
        static_root = os.path.realpath(STATIC_DIR)
        file_path = os.path.realpath(os.path.join(static_root, full_path))
        is_inside_static = file_path == static_root or file_path.startswith(static_root + os.sep)
        if full_path and is_inside_static and os.path.isfile(file_path):
            return FileResponse(file_path, headers=_NO_CACHE)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"), headers=_NO_CACHE)
else:
    logger.warning("STATIC_DIR=%s not found — SPA catch-all disabled", STATIC_DIR)

    @app.get("/")
    async def root():
        return {"message": "Transactions Dashboard API", "version": "1.0.0"}
