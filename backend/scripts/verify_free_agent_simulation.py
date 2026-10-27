"""Actual HTTP clients against local provider contracts and owner-isolated SQL."""
import hashlib
import os
from pathlib import Path
import sys
import httpx

provider, storage = sys.argv[1:3]
os.environ.update(AUTH_DISABLED='true', AI_PROVIDER='gemini-free',
    SUPABASE_URL=storage, SUPABASE_ANON_KEY='synthetic-key',
    GEMINI_API_KEY='synthetic-gemini', TAVILY_API_KEY='synthetic-search',
    GEMINI_FREE_KEY_SHA256=hashlib.sha256(b'synthetic-gemini').hexdigest(),
    TAVILY_FREE_KEY_SHA256=hashlib.sha256(b'synthetic-search').hexdigest(),
    GEMINI_API_BASE_URL=provider, TAVILY_API_BASE_URL=provider)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.security import _current_access_token, _current_user  # noqa: E402
from app.services import free_merchant_agent as agent  # noqa: E402
from fastapi import HTTPException  # noqa: E402
_current_access_token.set('synthetic-owner')
_current_user.set('00000000-0000-4000-8000-000000000001')

for mode in ['ok', 'empty', 'invented', 'uncertain', 'malformed', 'paid', 'paygo', 'quota']:
    httpx.post(provider+'/scenario', json={'mode': mode}).raise_for_status()
    name='Synthetic '+mode
    if mode in ('paid', 'paygo', 'quota'):
        try:
            agent.identify(name)
        except HTTPException:
            pass
        else:
            raise AssertionError('Expected free-only stop')
    else:
        result=agent.identify(name)
        assert bool(result) == (mode == 'ok'), mode
    first=httpx.get(provider+'/calls').json()
    # A second device/process reads the same durable storage; no local cache.
    agent.identify(name.upper()+' (תשלום 2/3)')
    assert httpx.get(provider+'/calls').json()==first, (mode,'Duplicate request')
    if mode in ('paid','paygo'):
        assert first['search']==first['gemini']==0
    if mode=='ok':
        agent.audit([{'merchant':name,'current':'קניות','total':999999,'count':42}])
        agent.subcategorize('אוכל',[{'merchant':name,'total':999999}])
        assert httpx.get(provider+'/calls').json()==first
    print('PASS',mode,first)
