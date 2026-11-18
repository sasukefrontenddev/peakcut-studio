"""Creator attribution and focused hashtags reach uploads without touching speech captions."""
import os,sys,tempfile,json
from pathlib import Path
from unittest.mock import patch
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(prefix='peakcut-postcopy-'),DATABASE_URL='',PEAKCUT_ACCOUNTS='0',PEAKCUT_FETCH_MODEL='0',PEAKCUT_UPDATE_CHECK='0')
sys.path.insert(0,'.')
from studio import postcopy,posting,creators,db,auth,ctx,server,jobs
from fastapi.testclient import TestClient
clip={'id':'clip1','status':'done','file':'clip.mp4','title':'That did not go to plan','description':'An unexpected GTA moment. #GTA6','category':'fail','hashtags':['viral','DuckyBhai','GTA6','Gaming','fyp','gaming'],'fixed_words':[{'w':'hello','s':0,'e':1}]}
creator={'name':'Ducky Bhai','creator_hashtags':'#DuckyBhai #DuckyBhaiClips #DuckyReloaded','privacy':'public','post_footer':''}
before=json.dumps(clip);copy=postcopy.build(clip,creator)
assert copy['title'].startswith('Ducky Bhai — ')
assert copy['hashtags']==['DuckyBhai','DuckyBhaiClips','DuckyReloaded','GTA6','Gaming'],copy
assert 'What would you have done differently?' in copy['caption']
assert copy['caption'].count('#GTA6')==1 and json.dumps(clip)==before
assert len(postcopy.build({'description':'x'*5000,'hashtags':['one']*100},{'name':'N'*1000})['caption'])<2200
assert postcopy.build({'title':'Ducky Bhai reacts','description':'Ducky Bhai reacts'},creator)['caption'].count('Ducky Bhai reacts')==1
assert postcopy.build({}, {'name':'Another Creator'})['hashtags'][:2]==['AnotherCreator','AnotherCreatorClips']
print('PASS creator-first title, relevant question, prioritized/deduplicated tags, caption bounds and unchanged speech')
db.init();u=auth.local_user();path=Path(os.environ['PEAKCUT_DATA']);(path/'clips').mkdir();(path/'clips'/'clip.mp4').write_bytes(b'video')
with ctx.as_user(u.id):
 c=creators.create({'name':'Ducky Bhai','creator_hashtags':creator['creator_hashtags']});assert creators.get(c['id'])['creator_hashtags']==creator['creator_hashtags']
 job={'id':'job1','user':u.id,'creator':c['id'],'dir':str(path),'clips':[clip]}
 for platform in ['youtube','instagram','tiktok','facebook']:
  row={'id':'post1','job':'job1','clip':'clip1','creator':c['id'],'account':'account1','account_name':'Page','status':'posting','tries':0}
  with patch.object(posting.jobs,'get',return_value=job),patch.object(posting.accounts,'get',return_value={'platform':platform,'name':'Page'}),patch.object(posting.accounts,platform+'_upload',return_value=('remote','https://example.invalid/post')) as upload,patch.object(posting,'_save'),patch.object(posting,'_mirror'),patch.object(posting.creators,'log'):
   posting._post(row)
   assert row['status']=='posted',row
   args=upload.call_args.args;caption=args[3] if platform in ('youtube','facebook') else args[2]
   assert 'Ducky Bhai' in caption and '#DuckyBhaiClips' in caption and '#DuckyReloaded' in caption
 print('PASS all four platform upload handlers receive the same creator-aware social copy')
 client=TestClient(server.app,base_url='http://127.0.0.1:8765')
 with patch.object(jobs,'get',return_value=job):
  response=client.get('/api/jobs/job1/clips/clip1/post-preview');assert response.status_code==200
  assert '#DuckyBhai' in response.json()['caption']
 with patch.object(jobs,'get',return_value=None):assert client.get('/api/jobs/job1/clips/clip1/post-preview').status_code==404
 print('PASS private caption preview respects job access')
