from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os

from backend.database import set_active_profile
from backend.routes import dashboard, analysis, recommendations, approval, profiles

# Create app
app = FastAPI(
    title="FinGuard",
    description="AI-Powered Personal Finance & Financial Risk Agent",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Profile Context Middleware for Multi-Profile Scoping
@app.middleware("http")
async def profile_context_middleware(request: Request, call_next):
    profile_id = (
        request.headers.get("X-Profile-ID")
        or request.query_params.get("profile_id")
        or request.cookies.get("profile_id")
        or "demo"
    )
    set_active_profile(profile_id)
    response = await call_next(request)
    return response

# Register routes
app.include_router(profiles.router)
app.include_router(dashboard.router)
app.include_router(analysis.router)
app.include_router(recommendations.router)
app.include_router(approval.router)

# Serve frontend static files
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        """Serve frontend files, fallback to index.html for SPA routing."""
        file_path = os.path.join(FRONTEND_DIR, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
