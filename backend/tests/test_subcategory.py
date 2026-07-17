"""Keyword-seeded subcategory derivation (קטגוריה_משנה).

derive_subcategory fills the subcategory from SUBCATEGORY_KEYWORDS, scoped to the
parent category, and only where a subcategory isn't already set (so a manual /
rule-assigned subcategory is preserved).
"""
import pandas as pd

from app.services.data_processor import derive_subcategory


def test_food_bakery_keyword():
    df = pd.DataFrame({'תיאור': ['מאפיית לחם ארז'], 'קטגוריה': ['אוכל']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == 'מאפיות'


def test_entertainment_cinema_keyword():
    df = pd.DataFrame({'תיאור': ['יס פלאנט ראשון'], 'קטגוריה': ['בילויים']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == 'סרטים'


def test_renamed_category_has_no_subcategory():
    # A user-renamed category has no submap entry → subcategory stays empty.
    df = pd.DataFrame({'תיאור': ['מאפיית לחם'], 'קטגוריה': ['הקטגוריה שלי']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == ''


def test_manual_subcategory_preserved_when_seeds_are_silent():
    df = pd.DataFrame({
        'תיאור': ['חנות מיוחדת'],
        'קטגוריה': ['אוכל'],
        'קטגוריה_משנה': ['בחירה ידנית'],
    })
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == 'בחירה ידנית'


def test_seeded_subcategory_overrides_stale_name():
    # Like the category catalog, seeded subcategories win when they have an
    # opinion — an AI-created "חשמלאים" on an appliance store gets repaired.
    df = pd.DataFrame({
        'תיאור': ['NETFLIX.COM 408-724-9160 NL', 'HOT NET אינטרנט', 'שקם אלקטריק-צמרת', 'GOOGLE MICROSOFT ONE'],
        'קטגוריה': ['הוצאות שוטפות', 'הוצאות שוטפות', 'קניות', 'טכנולוגיה'],
        'קטגוריה_משנה': ['ערוצים', '', 'חשמלאים', ''],
    })
    derive_subcategory(df)
    assert list(df['קטגוריה_משנה']) == ['סטרימינג', 'אינטרנט', 'אלקטרוניקה', 'תוכנה ואפליקציות']


def test_no_keyword_match_is_empty():
    df = pd.DataFrame({'תיאור': ['חנות כלשהי'], 'קטגוריה': ['אוכל']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == ''


def test_empty_frame_gets_column():
    df = pd.DataFrame({'תיאור': [], 'קטגוריה': []})
    derive_subcategory(df)
    assert 'קטגוריה_משנה' in df.columns


def test_food_supermarket_keyword():
    df = pd.DataFrame({'תיאור': ['שופרסל דיל רמת גן'], 'קטגוריה': ['אוכל']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == 'קניות גדולות'


def test_supermarket_chain_beats_wine_keyword():
    # 'יינות ביתן' contains the אלכוהול keyword 'יין' — the קניות גדולות entry comes
    # first in the parent's submap, so the chain must win.
    df = pd.DataFrame({'תיאור': ['יינות ביתן בע"מ'], 'קטגוריה': ['אוכל']})
    derive_subcategory(df)
    assert df['קטגוריה_משנה'].iloc[0] == 'קניות גדולות'


def test_expanded_seeds_cover_common_chains():
    df = pd.DataFrame({
        'תיאור': ['בית מרקחת אביב', 'גולף קניון רמת גן-גמ', 'BOOOM',
                   'כביש 6 חוצה צפון בע"מ', 'סנטרל פארק - חניון י', 'מפגש גרונר משלוחים'],
        'קטגוריה': ['תרופות וטיפולים', 'קניות', 'קניות',
                      'הוצאות משתנות', 'הוצאות משתנות', 'אוכל'],
        # Stale AI-created names get repaired; empties get filled.
        'קטגוריה_משנה': ['', 'בוטיקים', '', 'כביש מסלול', 'חניונים', ''],
    })
    derive_subcategory(df)
    assert list(df['קטגוריה_משנה']) == [
        'בתי מרקחת', 'אופנה', 'דברים לבית',
        'כבישי אגרה', 'חניונים', 'משלוחים',
    ]


def test_lottery_rows_unify_under_seeded_name():
    # One row got an AI-created 'מפעל הפיס' name, two stayed empty — the
    # seeded name repairs and unifies all of them.
    df = pd.DataFrame({
        'תיאור': ['מפעל הפיס', 'פיס מרכז -לשם המזל', 'מפעל הפיס אשראי'],
        'קטגוריה': ['בילויים'] * 3,
        'קטגוריה_משנה': ['מפעל הפיס', '', ''],
    })
    derive_subcategory(df)
    assert list(df['קטגוריה_משנה']) == ['פיס והימורים'] * 3
