"""Complete owner-only calendar with actual success dates, local time and distinct clips/uploads."""
import sys,os,tempfile
from datetime import datetime,timezone
from unittest.mock import patch
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(),PEAKCUT_FETCH_MODEL='0',DATABASE_URL='',PEAKCUT_ACCOUNTS='0',PEAKCUT_UPDATE_CHECK='0')
sys.path.insert(0,'.')
from studio import calendar,posting,creators,jobs,ctx,db,auth,server
from fastapi.testclient import TestClient
db.init();owner=auth.local_user()
def ts(s):return datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp()
base={'user':owner.id,'job':'j','clip':'c','creator':'creator','title':'Safe title','account_name':'Channel','platform':'youtube','status':'scheduled','due_at':ts('2026-11-18T21:00:00')}
rows=[dict(base,id=str(i),clip='c'+str(i),status='posted',posted_at=ts('2026-11-18T20:30:00')) for i in range(22)]
rows += [dict(base,id='multi-ig',clip='c0',platform='instagram',status='posted',posted_at=ts('2026-11-18T20:30:00')),dict(base,id='draft',status='needs_action',uploaded_at=ts('2026-11-19T05:00:00')),dict(base,id='cancel',status='cancelled'),dict(base,id='foreign',user='another-owner'),dict(base,id='scheduled'),dict(base,id='failed',status='failed')]
with ctx.as_user(owner.id),patch.object(posting,'_posts',rows),patch.object(creators,'all_creators',return_value=[{'id':'creator','name':'Creator'}]),patch.object(jobs,'list_jobs',return_value=[{'clips':[{'status':'done','made_at':ts('2026-11-18T21:00:00')},{'status':'error','made_at':ts('2026-11-18T21:00:00')},{'status':'queued','made_at':ts('2026-11-18T21:00:00')}]}]):
 d=calendar.read('2026-11-01','2026-12-01','Asia/Dubai')
 assert len(d['posts'])==26,len(d['posts'])
 assert d['totals']['posted']==23 and d['totals']['needs_action']==1 and d['totals']['scheduled']==1 and d['totals']['failed']==1
 assert d['totals']['clips']==23 and d['totals']['generated']==1,d['totals']
 assert all(p['day']=='2026-11-19' for p in d['posts'])
 assert all('user' not in p and p['id']!='foreign' for p in d['posts'])
 assert next(day for day in d['days'] if day['day']=='2026-11-19')['generated']==1
 assert d['platforms']['instagram']['posted']==1
 client=TestClient(server.app,base_url='http://127.0.0.1:8765')
 r=client.get('/api/posts/calendar',params={'start':'2026-11-01','end':'2026-12-01','time_zone':'Asia/Dubai'});assert r.status_code==200 and r.json()['totals']['posted']==23,(r.status_code,r.text)
 for a,b,z in [('bad','2026-12-01','UTC'),('2026-11-01','2026-11-01','UTC'),('2026-01-01','2026-12-01','UTC'),('2026-11-01','2026-12-01','Bad/Zone')]:
  assert client.get('/api/posts/calendar',params={'start':a,'end':b,'time_zone':z}).status_code==400
print('PASS complete history beyond recent 15, account isolation, local dates, unique clips, generation counts and draft/published separation')
# Daylight-saving boundaries must use local midnight, not an assumed fixed UTC offset.
with ctx.as_user(owner.id),patch.object(posting,'_posts',[dict(base,id='dst',due_at=ts('2026-11-01T04:30:00'))]),patch.object(creators,'all_creators',return_value=[]),patch.object(jobs,'list_jobs',return_value=[]):
 d=calendar.read('2026-11-01','2026-11-02','America/New_York');assert len(d['posts'])==1 and d['posts'][0]['day']=='2026-11-01'
print('PASS daylight-saving calendar boundary')
