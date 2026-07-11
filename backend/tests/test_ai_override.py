"""The 'בינה מלאכותית' (AI) category.

AI-tool merchants (ChatGPT, Claude, Midjourney, …) get their own top-level
category. It is applied as an UNCONDITIONAL override (like Psagot/foreign-card)
so charges that arrived already tagged 'חשמל ומחשבים' migrate on restore — and
so a user rule still wins over the override.
"""
import pandas as pd
import pytest

from app.services.data_processor import apply_unconditional_overrides
from app.api.routes import restore_session, sessions, RestoreSessionRequest, CategoryRule
from app.core.constants import AI_CATEGORY


def test_ai_override_migrates_pretagged_rows():
    df = pd.DataFrame({
        'תיאור': ['OPENAI *CHATGPT', 'Claude.ai subscription', 'שופרסל דיל'],
        'קטגוריה': ['חשמל ומחשבים', 'חשמל ומחשבים', 'מזון וצריכה'],
    })
    apply_unconditional_overrides(df)
    assert list(df['קטגוריה']) == [AI_CATEGORY, AI_CATEGORY, 'מזון וצריכה']


def test_ai_override_beats_foreign_card():
    # "CHATGPT US" looks like a foreign descriptor (trailing 'US'), but the AI
    # override runs last and must win.
    df = pd.DataFrame({'תיאור': ['CHATGPT US'], 'קטגוריה': ['שונות']})
    apply_unconditional_overrides(df)
    assert df['קטגוריה'].iloc[0] == AI_CATEGORY


def test_grammarly_is_an_ai_tool():
    # Real descriptor from the 2026-07 sync review ("GRAMMARLY CO ELTR6V9").
    df = pd.DataFrame({'תיאור': ['GRAMMARLY CO ELTR6V9'], 'קטגוריה': ['שונות']})
    apply_unconditional_overrides(df)
    assert df['קטגוריה'].iloc[0] == AI_CATEGORY


@pytest.mark.asyncio
async def test_ai_override_beats_user_rules_in_restore():
    """AI-tool spend is unconditional: stale rules (persisted before בינה
    מלאכותית existed, or junk from early AI runs) must not pull it out.
    apply_ai_tool_override re-runs AFTER rules in restore_session."""
    body = RestoreSessionRequest(
        transactions=[
            {'תאריך': '2026-01-05', 'סכום': -20, 'תיאור': 'OPENAI *CHATGPT',
             'קטגוריה': 'חשמל ומחשבים'},
        ],
        category_rules=[CategoryRule(merchant='OPENAI *CHATGPT', category='מנויים ושירותים')],
    )
    resp = await restore_session(body)
    df = sessions[resp['session_id']]
    assert df['קטגוריה'].iloc[0] == AI_CATEGORY
