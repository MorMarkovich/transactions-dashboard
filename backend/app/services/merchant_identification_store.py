"""Durable owner-scoped lookup leases. No service-role key or in-memory fallback."""
import httpx
from fastapi import HTTPException
from ..core.security import current_access_token, current_user_id, SUPABASE_URL, SUPABASE_ANON_KEY


def read_resolved(merchant: str):
    token = current_access_token()
    if not token or not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(503, 'שמירת זיהויי בתי העסק אינה זמינה; לא בוצע חיפוש')
    try:
        response = httpx.get(f'{SUPABASE_URL}/rest/v1/merchant_identifications', timeout=15,
            headers={'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}'},
            params={'user_id': f'eq.{current_user_id()}', 'merchant': f'eq.{merchant}',
                    'state': 'eq.resolved', 'select': 'result', 'limit': '1'})
        response.raise_for_status()
        rows = response.json()
        if not isinstance(rows, list):
            raise ValueError('Expected rows')
        return rows[0]['result'] if rows else None
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(503, 'שמירת זיהויי בתי העסק אינה זמינה; לא בוצע חיפוש') from exc


def rpc(name: str, body: dict):
    token = current_access_token()
    if not token or not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(503, 'שמירת זיהויי בתי העסק אינה זמינה; לא בוצע חיפוש')
    try:
        response = httpx.post(
            f'{SUPABASE_URL}/rest/v1/rpc/{name}', json=body, timeout=15,
            headers={'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}'},
        )
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, 'שמירת זיהויי בתי העסק אינה זמינה; הזיהוי נעצר') from exc


def claim(merchant: str):
    result = rpc('claim_merchant_lookup', {'p_merchant': merchant})
    if not isinstance(result, dict) or result.get('status') not in {'cached', 'claimed', 'deferred', 'quota'}:
        raise HTTPException(503, 'לא ניתן לאמת את מצב זיהוי בית העסק')
    return result


def finish(merchant: str, lease: str, result: dict, state: str):
    saved = rpc('finish_merchant_lookup', {
        'p_merchant': merchant, 'p_lease_token': lease, 'p_result': result, 'p_state': state,
    })
    if saved is not True:
        raise HTTPException(409, 'זיהוי בית העסק עודכן במקביל; טענו מחדש')
