# 💳 מנתח עסקאות כרטיס אשראי

דאשבורד מקצועי לניתוח עסקאות כרטיס אשראי עם תמיכה מלאה בעברית ו-RTL.

![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![Streamlit](https://img.shields.io/badge/Streamlit-1.28+-red.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## ✨ תכונות

- 📊 **ניתוח ויזואלי** - גרפים אינטראקטיביים עם Plotly
- 🏷️ **קטגוריות** - זיהוי אוטומטי של קטגוריות מ-MAX ובנקים אחרים
- 📑 **תמיכה באקסל** - קריאת קבצי Excel עם מספר גליונות
- 🔤 **עברית מלאה** - ממשק RTL מותאם לעברית
- 📥 **ייצוא** - הורדה לאקסל או CSV

## 🚀 התקנה מקומית

```bash
# שכפול הפרויקט
git clone https://github.com/YOUR_USERNAME/transactions-dashboard.git
cd transactions-dashboard

# יצירת סביבה וירטואלית
python -m venv venv
venv\Scripts\activate  # Windows
# או: source venv/bin/activate  # Linux/Mac

# התקנת תלויות
pip install -r requirements.txt

# הפעלה
streamlit run app.py
```

## 📁 פורמטים נתמכים

- **MAX** - קבצי אקסל מ-MAX כרטיסי אשראי
- **לאומי** - קבצי CSV מבנק לאומי
- **דיסקונט** - קבצי אקסל מבנק דיסקונט
- **כללי** - כל קובץ עם עמודות: תאריך, תיאור, סכום

## 📸 צילומי מסך

### דאשבורד ראשי
- סקירת הוצאות חודשיות
- התפלגות לפי קטגוריות
- ניתוח לפי ימים בשבוע

### טבלת עסקאות
- מיון לפי תאריך/סכום
- חיפוש וסינון
- ייצוא לאקסל

## 🛠️ טכנולוגיות

- **Streamlit** - ממשק משתמש
- **Pandas** - עיבוד נתונים
- **Plotly** - גרפים אינטראקטיביים
- **OpenPyXL** - קריאת קבצי Excel

## 📄 רישיון

MIT License - ראה קובץ LICENSE לפרטים.

---

נוצר עם ❤️ בישראל
