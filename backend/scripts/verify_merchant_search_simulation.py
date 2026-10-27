"""Exercise the real SDK + categorizer against a loopback-only Postman simulation."""
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

base = sys.argv[1]
assert urlparse(base).hostname in ('localhost', '127.0.0.1'), 'local simulation only'
os.environ['ANTHROPIC_API_KEY'] = 'synthetic-key'
os.environ['ANTHROPIC_BASE_URL'] = base.rstrip('/') + '/merchant-search'
os.environ['AI_WEB_SEARCH'] = '1'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services import ai_categorizer as ai

for mode in ['ok', 'failure', 'empty', 'invented', 'uncertain']:
    ai._CACHE.clear()
    answer = ai.categorize_transactions([f'Fixture {mode}'])
    assert answer == ({0: 'אוכל'} if mode == 'ok' else {}), (mode, answer)
    if mode != 'ok':
        assert not ai._CACHE, 'failed lookup must be retryable'
    print(f'PASS: {mode}')
print('PASS: 5 scenarios, real Anthropic SDK over loopback HTTP, synthetic only')
