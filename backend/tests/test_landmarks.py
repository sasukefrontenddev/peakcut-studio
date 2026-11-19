import sys,os,tempfile,json,io,base64
from PIL import Image
from unittest.mock import patch
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(),PEAKCUT_ACCOUNTS='0',DATABASE_URL='',PEAKCUT_FETCH_MODEL='0',PEAKCUT_VISION_MODEL='local-test-model')
sys.path.insert(0,'.')
from studio import landmarks,jobs,captions,creators
observation={'landmark':'airport','confidence':96,'evidence':'A terminal building and runway are clearly visible in both frames.'}
c=landmarks.candidate(observation,120,{},15,60)
assert c['start']==112 and c['end']==142 and c['score']>=90
assert 'this recording' in c['title'] and 'ever' not in c['title']
assert landmarks.candidate(observation,150,{'airport':{'at':120}}) is None
assert landmarks.candidate(None,150,{}) is None
assert len(landmarks.candidate(observation,1,{},15,20)['title'])<100
frames=[]
for color in ['red','blue']:
 out=io.BytesIO();Image.new('RGB',(320,180),color).save(out,format='JPEG');frames.append(out.getvalue())
class Reply:
 def raise_for_status(self):pass
 def json(self):return {'message':{'content':json.dumps(dict(observation,visible_in_both=True))}}
with patch.object(landmarks.httpx,'post',return_value=Reply()) as post:
 assert landmarks.detect(frames)['landmark']=='airport'
 assert post.call_args.args[0]=='http://127.0.0.1:11434/api/chat'
 encoded=post.call_args.kwargs['json']['messages'][0]['images']
 assert len(encoded)==1
 sheet=Image.open(io.BytesIO(base64.b64decode(encoded[0])))
 assert sheet.size==(512,144) and sheet.getpixel((128,72))[0]>200 and sheet.getpixel((384,72))[2]>200
for bad in [dict(observation,visible_in_both=False),dict(observation,visible_in_both=True,confidence=89),dict(observation,visible_in_both=True,landmark='none')]:
 with patch.object(Reply,'json',return_value={'message':{'content':json.dumps(bad)}}),patch.object(landmarks.httpx,'post',return_value=Reply()):assert landmarks.detect(frames) is None
print('PASS strict two-frame visual confirmation, confidence threshold, first-per-recording deduplication, bounded local inference')
job={'source_path':'/tmp/source.mp4'};c.update(captions=False)
with patch.object(captions,'available',return_value=True),patch.object(captions,'transcribe_clip',return_value=([{'w':'unrelated','s':0,'e':1}],'en')):
 title=c['title'];jobs.ground_post(job,c);assert c['title']==title and c['post_copy_source']=='visual-landmark'
print('PASS visually supported first-reveal metadata is preserved when spoken dialogue concerns something else')
try:creators._clean({'selection_mode':'made-up'});raise AssertionError('bad mode')
except ValueError:pass
from studio import posting
with patch.object(posting.creators,'get',return_value={'selection_mode':'landmarks','autopost':True,'accounts':['a'],'post_min_score':75}),patch.object(posting,'enqueue',return_value=[]) as enqueue:
 posting.on_clip_ready({'creator':'c'},{'score':95});enqueue.assert_not_called()
 posting.on_clip_ready({'creator':'c'},{'score':92,'selection_source':'visual-landmark'});enqueue.assert_called_once()
print('PASS old reaction clips finishing after restart do not refill the first-reveal posting queue')
