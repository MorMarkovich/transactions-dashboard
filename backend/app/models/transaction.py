"""
Transaction model
"""
from pydantic import BaseModel
from typing import Optional
from datetime import date


class Transaction(BaseModel):
    תאריך: date
    תיאור: str
    קטגוריה: str
    סכום: float
    סכום_מוחלט: Optional[float] = None
    חודש: Optional[str] = None
    יום_בשבוע: Optional[int] = None
