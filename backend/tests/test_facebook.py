"""Facebook Page tokens stay private; retries keep the same Reel and publication is confirmed."""
import os, sys, tempfile, json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from unittest.mock import patch
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(prefix='peakcut-facebook-'), DATABASE_URL='', PEAKCUT_ACCOUNTS='0', PEAKCUT_FETCH_MODEL='0', PEAKCUT_UPDATE_CHECK='0')
sys.path.insert(0,'.')
import httpx
from studio import accounts, auth, db, ctx, media, posting

db.init();u=auth.local_user()
def reply(data):return httpx.Response(200,json=data)
with ctx.as_user(u.id):
 with patch.object(accounts,'app_keys',return_value=('app-12345','app-secret')):
  url=accounts.connect_url('facebook');q=parse_qs(urlparse(url).query)
  assert set(q['scope'][0].split(','))=={'pages_show_list','pages_read_engagement','pages_manage_posts'}
  def get(url,**kw):
   if url.endswith('/oauth/access_token'):return reply({'access_token':'user-token'})
   return reply({'data':[{'id':'12345','name':'Target Page','tasks':['CREATE_CONTENT'],'access_token':'private-page-token'}, {'id':'999','name':'No publishing task','tasks':['ANALYZE'],'access_token':'excluded'}]})
  with patch.object(accounts.httpx,'get',side_effect=get):a=accounts.connect_finish('facebook','one-time-code',q['state'][0])
  assert a['id']=='fb_12345' and len(accounts.list_accounts())==1
  assert 'private-page-token' not in json.dumps(accounts.list_accounts())
  try:accounts.connect_finish('facebook','reused-code',q['state'][0]);raise AssertionError('OAuth state reused')
  except ValueError:pass
 print('PASS limited Facebook scopes, Page publishing task, private credentials and single-use authorization')
 p=Path(os.environ['PEAKCUT_DATA'])/'clip.mp4';p.write_bytes(b'test-video');state={};calls=[]
 def post(url,**kw):
  calls.append((url,kw));return reply({'video_id':'555','upload_url':'https://evil.invalid/upload'} if kw.get('data',{}).get('upload_phase')=='start' else {'success':True})
 with patch.object(media,'probe',return_value={'duration':20,'width':1080,'height':1920}),patch.object(accounts.httpx,'post',side_effect=post),patch.object(accounts.httpx,'get',return_value=reply({'status':{'publishing_phase':{'publish_status':'published'}}})):
  rid,url=accounts.facebook_upload(a,p,'A title','Caption',state=state)
  assert rid=='555' and len(calls)==3
  assert calls[1][0]=='https://rupload.facebook.com/video-upload/v27.0/555'
  assert calls[1][1]['content']==b'test-video' and calls[1][1]['headers']['file_size']=='10'
  assert calls[2][1]['data']['video_state']=='PUBLISHED'
  accounts.facebook_upload(a,p,'A title','Caption',state=state);assert len(calls)==3,'Duplicate Reel uploaded'
 print('PASS local byte upload only to Meta, public Page publication, confirmed result and no duplicate retry')
 with patch.object(accounts.httpx,'post',side_effect=AssertionError('No repeated upload')),patch.object(accounts.httpx,'get',return_value=reply({'status':{'publishing_phase':{'publish_status':'draft'}}})),patch.object(accounts.time,'sleep'):
  try:accounts.facebook_upload(a,p,'title','caption',state={'video_id':'555','phase':'finishing'});raise AssertionError('Unconfirmed publication marked posted')
  except accounts.FacebookPublishingPending:pass
 print('PASS unconfirmed Facebook publication stays pending without another upload')
 responses = iter([reply({'status':{'uploading_phase':{'status':'completed'}}}), reply({'status':{'publishing_phase':{'publish_status':'published'}}})])
 with patch.object(accounts.httpx,'get',side_effect=lambda *a,**k:next(responses)),patch.object(accounts.httpx,'post',return_value=reply({'success':True})) as post:
  accounts.facebook_upload(a,p,'title','caption',state={'video_id':'555','phase':'created'})
  assert post.call_count==1 and post.call_args.kwargs['data']['upload_phase']=='finish'
 print('PASS interrupted upload resumes the same video instead of uploading a duplicate')
 row={'id':'post-test','user':u.id,'job':'job','clip':'clip','creator':'creator','account':'fb_12345','status':'posting','tries':0,'due_at':0,'title':'Test'}
 job={'id':'job','creator':'creator','dir':str(p.parent),'clips':[{'id':'clip','file':'clip.mp4','status':'done','title':'Test'}]}
 with patch.object(posting.jobs,'get',return_value=job),patch.object(posting.accounts,'get',return_value=a),patch.object(posting.creators,'get',return_value={'privacy':'public','post_footer':''}),patch.object(posting.accounts,'facebook_upload',side_effect=accounts.FacebookPublishingPending('Processing')),patch.object(posting,'_save'),patch.object(posting,'_mirror'):
  posting._post(row)
 assert row['status']=='scheduled' and row['tries']==0 and 'posted_at' not in row
 with patch.object(media,'probe',return_value={'duration':100,'width':1080,'height':1920}),patch.object(accounts.httpx,'post',side_effect=AssertionError('Invalid clip uploaded')):
  try:accounts.facebook_upload(a,p,'title','caption');raise AssertionError('Long clip accepted')
  except accounts.FacebookSetupRequired:pass
 print('PASS processing queue state and invalid duration rejected before upload')
with ctx.as_user(u.id):
 import time
 now=time.time()
 history=[{'user':u.id,'account':'fb_12345','status':'posted','posted_at':now-100-i,'due_at':now-100-i,'job':'previous','clip':str(i)} for i in range(30)]
 with patch.object(posting,'_posts',history),patch.object(posting.creators,'get',return_value={'post_gap_min':5,'daily_cap':50}),patch.object(posting,'_save'),patch.object(posting,'_mirror'):
  made=posting.enqueue({'id':'new-job','creator':'creator'},{'id':'new-clip'},['fb_12345'],now=True)
  assert made[0]['due_at']>now+86000
 print('PASS Facebook rolling 30-Reel limit also applies to immediate queue requests')
print('ALL FACEBOOK CHECKS PASSED')
