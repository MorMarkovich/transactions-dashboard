"""Test configuration: HTTP authentication is exercised separately."""
import os

os.environ.setdefault("AUTH_DISABLED", "true")
os.environ.setdefault("AI_PROVIDER", "anthropic")  # legacy fixtures; no live API key
