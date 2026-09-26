"""Vercel Serverless Function Entrypoint for FinGuard.
Exports the FastAPI app for Vercel's Python runtime.
"""
import sys
import os

# Add project root to sys.path so 'backend' package is discoverable
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app import app
