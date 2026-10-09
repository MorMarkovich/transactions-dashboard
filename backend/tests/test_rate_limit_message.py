import re

import pytest
from fastapi import HTTPException

from app.core import security

HEBREW = re.compile(r"[\u0590-\u05FF]")


def test_rate_limit_message_is_hebrew():
    uid = "rate-limit-test-user"
    security._rate_events.pop((uid, "t"), None)
    security._rate_limit(uid, "t", 1, 60)
    with pytest.raises(HTTPException) as exc:
        security._rate_limit(uid, "t", 1, 60)
    assert exc.value.status_code == 429
    assert HEBREW.search(exc.value.detail)
    assert "Retry-After" in exc.value.headers
