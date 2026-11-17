"""Unified Instagram login keeps secrets local and uses the correct API host."""
import os, sys, tempfile, time
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(prefix='peakcut-unified-'), DATABASE_URL='', PEAKCUT_ACCOUNTS='0', PEAKCUT_FETCH_MODEL='0', PEAKCUT_UPDATE_CHECK='0')
sys.path.insert(0, '.')
import httpx
from studio import accounts, auth, ctx, db

db.init(); auth.local_user()
with ctx.as_user(auth._local.id):
    accounts.save_app('instagram', '123456789', 'private-test-secret', '987654321')
    query = parse_qs(urlparse(accounts.connect_url('instagram')).query)
    assert query['config_id'] == ['987654321'] and 'scope' not in query
    calls = []
    def get(url, **kwargs):
        calls.append(url)
        if url.endswith('/oauth/access_token'):
            return httpx.Response(200, json={'access_token': 'private-posting-token', 'expires_in': 3600})
        if url.endswith('/assigned_instagram_accounts'):
            return httpx.Response(200, json={'data': [{'id': '991', 'username': 'test_creator'}]})
        return httpx.Response(200, json={'client_business_id': '881'})
    with patch.object(accounts.httpx, 'get', side_effect=get):
        account = accounts.connect_finish('instagram', 'test-code', query['state'][0])
    assert account['name'] == '@test_creator' and account['client_business_id'] == '881'
    assert all(url.startswith(accounts.IG_UNIFIED) for url in calls)
    assert 'private-posting-token' not in str(accounts.list_accounts())
    assert 'private-test-secret' not in str(accounts.apps_public())
    assert accounts._ig_host(account) == accounts.IG_UNIFIED
    with patch.object(accounts.httpx, 'get', side_effect=AssertionError('must not use legacy refresh')):
        assert accounts._ig_token(account) == 'private-posting-token'
    account['expires_at'] = time.time() - 1
    try:
        accounts._ig_token(account)
        raise AssertionError('expired token accepted')
    except ValueError:
        pass
    accounts.save_app('instagram', '123456789', '')
    assert accounts.apps_public()['instagram']['config_id'] == '987654321'
    accounts.save_app('instagram', '123456789', '', '')
    assert urlparse(accounts.connect_url('instagram')).netloc == 'www.instagram.com'
print('PASS unified login, account identity, private tokens, expiry and legacy compatibility')
