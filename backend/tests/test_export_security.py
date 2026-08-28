from openpyxl import load_workbook
import pandas as pd

from app.services.export_service import export_to_excel


def test_export_does_not_turn_descriptions_into_formulas():
    frame = pd.DataFrame(
        [{
            "תאריך": pd.Timestamp("2026-08-28"),
            "תיאור": '=HYPERLINK("https://example.invalid","click")',
            "קטגוריה": "שונות",
            "סכום": -10.0,
        }]
    )

    workbook = load_workbook(export_to_excel(frame), data_only=False)
    cell = workbook["עסקאות"]["B2"]
    assert cell.value.startswith("=HYPERLINK")
    assert cell.data_type == "s"
