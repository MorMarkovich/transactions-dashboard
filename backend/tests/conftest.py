"""Test configuration: HTTP authentication is exercised separately."""
import os

os.environ.setdefault("AUTH_DISABLED", "true")
