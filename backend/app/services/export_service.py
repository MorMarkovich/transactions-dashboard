"""
Export service for generating Excel files
"""
import pandas as pd
from io import BytesIO
from typing import Optional


def export_to_excel(df: pd.DataFrame, filters: Optional[dict] = None) -> BytesIO:
    """ייצוא ל-Excel עם עיצוב מקצועי"""
    output = BytesIO()
    
    # יצירת DataFrame לייצוא
    export_df = df[['תאריך', 'תיאור', 'קטגוריה', 'סכום']].copy()
    export_df['תאריך'] = export_df['תאריך'].dt.strftime('%d/%m/%Y')
    export_df['סכום'] = export_df['סכום'].abs()
    
    # יצירת Excel
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        export_df.to_excel(writer, sheet_name='עסקאות', index=False)
        
        workbook = writer.book
        worksheet = writer.sheets['עסקאות']
        
        # עיצוב
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#667eea',
            'font_color': 'white',
            'align': 'right',
            'valign': 'vcenter',
            'border': 1
        })
        
        cell_format = workbook.add_format({
            'align': 'right',
            'valign': 'vcenter',
            'border': 1
        })
        
        # עיצוב כותרות
        for col_num, value in enumerate(export_df.columns.values):
            worksheet.write(0, col_num, value, header_format)
        
        # עיצוב תאים
        for row in range(1, len(export_df) + 1):
            for col in range(len(export_df.columns)):
                worksheet.write(row, col, export_df.iloc[row-1, col], cell_format)
        
        # התאמת רוחב עמודות
        worksheet.set_column('A:A', 12)  # תאריך
        worksheet.set_column('B:B', 40)   # תיאור
        worksheet.set_column('C:C', 20)   # קטגוריה
        worksheet.set_column('D:D', 15)   # סכום
    
    output.seek(0)
    return output
