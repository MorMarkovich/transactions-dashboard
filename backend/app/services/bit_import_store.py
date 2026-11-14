"""Store approved Bit classifications with the signed-in user's RLS policy."""
import httpx
from fastapi import HTTPException

from ..core.security import current_access_token, current_user_id, SUPABASE_ANON_KEY, SUPABASE_URL


def save_new_bit_overrides(rows: list[dict]) -> set[str]:
    token = current_access_token()
    if not token or not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(503, 'שמירת סיווגי Bit אינה זמינה. נסו שוב.')
    try:
        response = httpx.post(
            f'{SUPABASE_URL}/rest/v1/transaction_overrides',
            params={'on_conflict': 'user_id,txn_key', 'select': 'txn_key'},
            headers={
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': f'Bearer {token}',
                'Prefer': 'resolution=ignore-duplicates,return=representation',
            },
            json=[{
                'user_id': current_user_id(),
                'txn_key': row['txn_key'],
                'category': row['category'],
                'subcategory': row['subcategory'] or None,
            } for row in rows],
            timeout=15,
        )
        response.raise_for_status()
        return {row['txn_key'] for row in response.json()}
    except (httpx.HTTPError, ValueError, TypeError, KeyError) as error:
        raise HTTPException(503, 'שמירת סיווגי Bit נכשלה. טענו את הרשימה ונסו שוב.') from error
