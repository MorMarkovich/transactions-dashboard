"""Keyword-seeded subcategory derivation (קטגוריה_משנה).

derive_subcategory fills the subcategory from SUBCATEGORY_KEYWORDS, scoped to the
parent category, and only where a subcategory isn't already set (so a manual /
rule-assigned subcategory is preserved).
"""
import pandas as pd

from app.services.data_processor import derive_subcategory


def test_food_bakery_keyword():
    df = pd.DataFrame({'תיאור': ['מאפיית לחם ארז'], 'קטגוריה': ['מזון וצריכה']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == 'מאפיות'


def test_entertainment_cinema_keyword():
    df = pd.DataFrame({'תיאור': ['יס פלאנט ראשון'], 'קטגוריה': ['פנאי, בידור וספורט']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == 'קולנוע'


def test_renamed_category_has_no_subcategory():
    # A user-renamed category has no submap entry → subcategory stays empty.
    df = pd.DataFrame({'תיאור': ['מאפיית לחם'], 'קטגוריה': ['הקטגוריה שלי']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == ''


def test_manual_subcategory_is_preserved():
    df = pd.DataFrame({
        'תיאור': ['מאפיית לחם'],
        'קטגוריה': ['מזון וצריכה'],
        'קטגוריה_משנה': ['בחירה ידנית'],
    })
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == 'בחירה ידנית'


def test_no_keyword_match_is_empty():
    df = pd.DataFrame({'תיאור': ['חנות כלשהי'], 'קטגוריה': ['מזון וצריכה']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == ''


def test_empty_frame_gets_column():
    df = pd.DataFrame({'תיאור': [], 'קטגוריה': []})
    derive_subcategory(df)
    assert 'קטגוריה_משנה' in df.columns
