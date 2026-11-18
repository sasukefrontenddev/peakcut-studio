import sys
from unittest.mock import patch
sys.path.insert(0,'.')
from studio import speechcopy
words=[{'w':w,'s':i,'e':i+0.5} for i,w in enumerate('ये टायर किसने फोड़े क्या ये मस्टैंग है'.split())]
with patch.object(speechcopy.ai,'ready',return_value=True),patch.object(speechcopy.ai,'provider',return_value='ollama'),patch.object(speechcopy.ai,'models',return_value=['local']),patch.object(speechcopy.ai,'call',return_value=({'title':'Who popped the tyres?','description':'He asks who popped the tyres and whether this is a Mustang.','quote':'ये टायर किसने फोड़े'},0,0)) as call:
 out=speechcopy.build(words,'hi')
 assert out['title']=='Who popped the tyres?' and out['hashtags']==[]
 assert 'ये टायर किसने' in call.call_args.args[1]
with patch.object(speechcopy.ai,'ready',return_value=True),patch.object(speechcopy.ai,'provider',return_value='ollama'),patch.object(speechcopy.ai,'models',return_value=['local']),patch.object(speechcopy.ai,'call',return_value=({'title':'Math fails','description':'A math problem','quote':'invented words here'},0,0)):
 out=speechcopy.build(words,'hi');assert out['description']=='' and out['hashtags']==[] and out['post_copy_note']
with patch.object(speechcopy.ai,'ready',return_value=True),patch.object(speechcopy.ai,'provider',return_value='openai'),patch.object(speechcopy.ai,'call') as call:
 assert speechcopy.build(words,'hi')['description']=='';call.assert_not_called()
assert speechcopy.fingerprint(words,'hi')!=speechcopy.fingerprint(words,'ur')
print('PASS native Hindi evidence, unsupported-story fallback, no paid provider calls and language cache invalidation')
from studio import jobs
job={'source_path':'/tmp/source.mp4'}
clip={'start':10,'end':20,'captions':False,'title':'Math fails','description':'math problem','hashtags':['MathFails','Giveaway']}
with patch.object(jobs.captions,'available',return_value=True),patch.object(jobs.captions,'transcribe_clip',return_value=(words,'hi')) as transcribe,patch.object(speechcopy,'build',return_value={'title':'Tyres','description':'A tyre question','hashtags':[]}) as build:
 jobs.ground_post(job,clip)
 assert clip['title']=='Tyres' and clip['hashtags']==[]
 assert transcribe.call_args.kwargs['romanize'] is False
 jobs.ground_post(job,clip)
 assert transcribe.call_count==1 and build.call_count==1
 clip['end']=21;jobs.ground_post(job,clip);assert transcribe.call_count==2
print('PASS subtitles-off still verifies speech, replaces stale metadata, reuses exact-span cache and invalidates trim changes')
