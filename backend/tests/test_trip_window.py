"""Trip-window heuristic: latin-only שונות rows within ±3 days of confirmed
overseas card spend are the same trip (truncated country suffix) → travel."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from app.services.data_processor import apply_trip_window_heuristic  # noqa: E402


def _df(rows):
    df = pd.DataFrame(rows)
    df['תאריך'] = pd.to_datetime(df['תאריך'])
    return df


def test_trip_window_moves_nearby_latin_misc_rows():
    df = _df([
        # Anchor: confirmed overseas (country suffix, already travel).
        {'תאריך': '2026-06-20', 'תיאור': 'SHINSEGAE DEPARTMENT S SEOUL         KR', 'קטגוריה': 'טיסות ותיירות'},
        # Truncated-suffix trip spend two days later → repaired.
        {'תאריך': '2026-06-22', 'תיאור': 'CHARM BKK', 'קטגוריה': 'שונות'},
        # Hebrew merchant on the same date → NOT touched (local spend).
        {'תאריך': '2026-06-22', 'תיאור': 'שוקי מגי', 'קטגוריה': 'שונות'},
        # Latin merchant a month away → NOT touched.
        {'תאריך': '2026-07-25', 'תיאור': 'NATIVE', 'קטגוריה': 'שונות'},
        # Exempt online service during the trip → NOT touched.
        {'תאריך': '2026-06-21', 'תיאור': 'NETFLIX.COM', 'קטגוריה': 'שונות'},
    ])
    changed = apply_trip_window_heuristic(df)
    assert changed == 1
    assert df.loc[1, 'קטגוריה'] == 'טיסות ותיירות'
    assert df.loc[2, 'קטגוריה'] == 'שונות'
    assert df.loc[3, 'קטגוריה'] == 'שונות'
    assert df.loc[4, 'קטגוריה'] == 'שונות'


def test_no_anchors_no_changes():
    df = _df([
        {'תאריך': '2026-06-22', 'תיאור': 'CHARM BKK', 'קטגוריה': 'שונות'},
        # Travel category but Hebrew/no suffix (e.g. a flight bought in Israel)
        # is NOT an anchor — bookings months ahead must not open a window.
        {'תאריך': '2026-06-21', 'תיאור': 'אל על נתיבי אויר', 'קטגוריה': 'טיסות ותיירות'},
    ])
    assert apply_trip_window_heuristic(df) == 0
    assert df.loc[0, 'קטגוריה'] == 'שונות'
