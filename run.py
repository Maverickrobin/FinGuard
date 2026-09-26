#!/usr/bin/env python3
"""FinGuard — AI-Powered Personal Finance & Financial Risk Agent
Single entry point: python run.py
"""
import sys
import os

# Auto-detect and re-exec with .venv if running with system python without dependencies
venv_python = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv", "bin", "python")
if os.path.exists(venv_python) and sys.executable != venv_python:
    try:
        import fastapi
        import uvicorn
    except ImportError:
        os.execv(venv_python, [venv_python] + sys.argv)

import uvicorn

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import init_db
from backend.ingestion.synthetic_generator import generate_synthetic_data

def main():
    print("=" * 60)
    print("  FinGuard — Personal Finance & Risk Agent")
    print("=" * 60)
    
    # Initialize database
    print("\n[1/3] Initializing database...")
    init_db()
    
    # Generate synthetic data if not already present
    print("[2/3] Checking synthetic data...")
    generate_synthetic_data()
    
    port = int(os.environ.get("PORT", 8000))
    is_dev = os.environ.get("ENV", "development").lower() == "development"
    
    # Start server
    print(f"[3/3] Starting server on http://0.0.0.0:{port}")
    print(f"       Dashboard: http://localhost:{port}")
    print("=" * 60)
    
    uvicorn.run(
        "backend.app:app",
        host="0.0.0.0",
        port=port,
        reload=is_dev,
        log_level="info"
    )

if __name__ == "__main__":
    venv_python = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv", "bin", "python")
    if os.path.exists(venv_python) and sys.executable != venv_python:
        try:
            import fastapi
        except ImportError:
            os.execv(venv_python, [venv_python] + sys.argv)
    main()
