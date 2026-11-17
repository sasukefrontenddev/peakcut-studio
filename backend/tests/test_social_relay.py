"""Private-browser OAuth and free signed-link transport. All provider calls are stand-ins."""
import os,sys,tempfile,json,time
from pathlib import Path
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(prefix='peakcut-social-'),DATABASE_URL='',PEAKCUT_ACCOUNTS='0',PEAKCUT_PUBLIC_URL='http://127.0.0.1:8765',PEAKCUT_SOCIAL_CALLBACK_ORIGIN='https://peakcut-studio-chi.vercel.app',PEAKCUT_FETCH_MODEL='0',PEAKCUT_UPDATE_CHECK='0')
sys.path.insert(0,'.')
from fastapi.testclient import TestClient
from studio import server,accounts,social,config,db,auth,ctx
from urllib.parse import urlparse,parse_qs
db.init();auth.local_user()
client=TestClient(server.app,base_url='http://127.0.0.1:8765');headers={'Origin':'http://127.0.0.1:8765'}
with ctx.as_user(auth._local.id):
 accounts.save_app('instagram','1234567890','test-secret-not-real')
 accounts.save_app('tiktok','test-key-123','test-secret-not-real')
assert client.get('/api/apps').json()['instagram']['redirect']=='https://peakcut-studio-chi.vercel.app/oauth/instagram/callback'
assert client.get('/api/apps').json()['tiktok']['https'] is True
assert client.post('/api/social/tiktok/start',json={},headers={'Origin':'https://evil.example'}).status_code==403
r=client.post('/api/social/tiktok/start',json={},headers=headers);assert r.status_code==200
q=parse_qs(urlparse(r.json()['url']).query);state=q['state'][0]
assert q['redirect_uri']==['https://peakcut-studio-chi.vercel.app/oauth/tiktok/callback']
assert client.post('/api/social/unknown/start',json={},headers=headers).status_code==404
assert client.post('/api/social/tiktok/finish',json={'state':'wrong','code':'bad'},headers=headers).status_code==400
old=accounts._tiktok_finish
accounts._tiktok_finish=lambda code:{'id':'fake','name':'Test creator','access_token':'must-never-leave-engine'}
r=client.post('/api/social/tiktok/finish',json={'state':state,'code':'fake-code'},headers=headers)
assert r.status_code==200 and r.json()['name']=='Test creator';assert 'access_token' not in r.text
assert client.post('/api/social/tiktok/finish',json={'state':state,'code':'fake-code'},headers=headers).status_code==400
accounts._tiktok_finish=old
f=config.DATA_DIR/'social-network.json'
f.write_text(json.dumps({'url':'https://free-test.trycloudflare.com','expires':time.time()+90}));assert social.media_origin()=='https://free-test.trycloudflare.com'
with ctx.as_user(auth._local.id):assert accounts.clip_link('example-job','clip01.mp4').startswith('https://free-test.trycloudflare.com/pub/')
f.write_text(json.dumps({'url':'https://free-test.trycloudflare.com','expires':time.time()-1}));assert not social.media_origin()
f.write_text(json.dumps({'url':'https://evil.example','expires':time.time()+90}));assert not social.media_origin()
f.write_text('broken json');assert not social.media_origin()
print('PASS stable HTTPS callback, origin protection, one-time OAuth state, private tokens, signed media base and expiry')
