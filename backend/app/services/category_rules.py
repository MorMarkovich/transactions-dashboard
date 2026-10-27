"""Explicit user choices outrank automatic rules; legacy origin is unknown."""
import pandas as pd


def manual_rule_mask(df: pd.DataFrame) -> pd.Series:
    if '_manual_rule' in df.columns:
        return df['_manual_rule'].fillna(False).astype(bool)
    return pd.Series(False, index=df.index)


def apply_manual_rules(df, rules, valid_categories):
    # Imports stay local to avoid a processor/rule module cycle.
    from .data_processor import normalize_merchant
    from ..core.constants import migrate_category

    chosen = {}
    for rule in rules:
        if rule.source != 'manual':
            continue
        category, _ = migrate_category(rule.category, rule.subcategory)
        if category not in valid_categories:
            continue
        key = normalize_merchant(rule.merchant)
        if not key:
            continue
        rank = (rule.updated_at or '', rule.merchant)
        if key not in chosen or rank > chosen[key][0]:
            chosen[key] = (rank, rule)
    normalized = df['תיאור'].map(normalize_merchant)
    for key, (_, rule) in chosen.items():
        category, migrated_sub = migrate_category(rule.category, rule.subcategory)
        if category not in valid_categories:
            continue
        mask = normalized == key
        df.loc[mask, 'קטגוריה'] = category
        df.loc[mask, 'קטגוריה_משנה'] = (
            migrated_sub if migrated_sub is not None else rule.subcategory
        ) or ''
        df.loc[mask, '_manual_rule'] = True
