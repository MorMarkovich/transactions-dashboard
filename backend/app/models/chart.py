"""
Chart model
"""
from typing import List, Dict, Any
from pydantic import BaseModel


class ChartData(BaseModel):
    data: List[Dict[str, Any]]
    layout: Dict[str, Any]
