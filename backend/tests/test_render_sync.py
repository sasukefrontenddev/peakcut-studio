"""Decode real long-GOP TS media and check flash/beep sync after non-keyframe trims."""
import os,sys,tempfile,subprocess,json
from pathlib import Path
from unittest.mock import patch
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(prefix='peakcut-render-sync-'),DATABASE_URL='',PEAKCUT_ACCOUNTS='0',PEAKCUT_FETCH_MODEL='0',PEAKCUT_UPDATE_CHECK='0')
sys.path.insert(0,'.')
import numpy as np
from studio import render,tools,jobs,creators,auth,ctx,db,brain,captions
assert not tools.setup(),'FFmpeg must be configured for the media regression test'
root=Path(os.environ['PEAKCUT_DATA']);source=root/'fixture.ts'
subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i',"color=black:s=360x640:r=30:d=44,drawbox=color=white:t=fill:enable='lt(mod(t,1),0.1)'",'-f','lavfi','-i',r'aevalsrc=if(lt(mod(t\,1)\,0.1)\,0.7*sin(2*PI*1000*t)\,0):s=48000:d=44','-c:v','libx264','-threads','2','-preset','veryfast','-g','180','-keyint_min','180','-sc_threshold','0','-c:a','aac','-f','mpegts',str(source)],check=True)
render.W,render.H=360,640;render._qsv_ok=False;render.install_fonts()
for start in [2.15,34.15]:
 name='trim-'+str(int(start));out=render.render_clip(source,root/name,name,{'start':start,'end':start+6,'layout':'crop','captions':False},[],360,640);file=root/name/out['file']
 meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(file)]));times={s['codec_type']:float(s['start_time']) for s in meta['streams']}
 assert abs(times['video']-times['audio'])<0.04,times
 # Decode the generated clip; a one-second visual flash must coincide with its audio pulse.
 video=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-an','-vf','scale=1:1','-pix_fmt','gray','-f','rawvideo','pipe:1']),dtype=np.uint8)
 audio=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1']),dtype=np.float32)
 peaks=np.where(video>150)[0]/30
 energy=np.sqrt(np.mean(audio[:len(audio)//480*480].reshape(-1,480)**2,axis=1));hits=np.where(energy>max(energy)*0.4)[0]/100
 assert len(peaks)>6 and len(hits)>6
 first_video=float(peaks[0]);first_audio=float(hits[0]);assert abs(first_video-first_audio)<0.06,(start,first_video,first_audio)
 assert abs(first_video-0.85)<0.06,(start,first_video)
 print('PASS real TS trim',start,'seconds: video/audio starts',times,'flash/beep difference',round(abs(first_video-first_audio),3),flush=True)
# Option inheritance and an existing clip’s re-render both preserve an explicit False.
db.init();u=auth.local_user()
with ctx.as_user(u.id):
 c=creators.create({'name':'Caption setting test','captions':False});j=jobs.create({'type':'file','name':'fixture'}, {},enqueue=False,creator=c['id']);assert j['options']['captions'] is False
 assert jobs.clean_options({'captions':False})=={'captions':False}
 clip={'id':'clip1','start':0,'end':5,'captions':True};j['clips']=[clip]
 with patch.object(jobs,'save'),patch.object(jobs._q,'put'):jobs.request_render(j['id'],'clip1',{'captions':False})
 assert clip['captions'] is False
 try:jobs.clean_options({'captions':'false'});raise AssertionError('String accepted as toggle')
 except ValueError:pass
print('PASS creator inheritance, per-clip toggle, and strict captions option')
# No caption dialog events when off, while the independently editable hook remains available.
with patch.object(render,'_render_in',return_value={}) as draw:
 render.render_clip(source,root/'off','off',{'start':0,'end':5,'captions':False,'hook':'TITLE'},[{'w':'hello','s':1,'e':2}],360,640)
 ass=draw.call_args.args[-1];assert not any(',Cap,' in l for l in ass.splitlines() if l.startswith('Dialogue:'));assert ',Hook,' in ass
 render.render_clip(source,root/'on','on',{'start':0,'end':5,'captions':True},[{'w':'hello','s':1,'e':2}],360,640)
 assert any(',Cap,' in l for l in draw.call_args.args[-1].splitlines() if l.startswith('Dialogue:'))
print('PASS captions can be disabled and re-enabled without removing hook titles')

original=[{'w':'oh','s':0,'e':0.3},{'w':'my','s':0.3,'e':0.6},{'w':'god','s':0.6,'e':1}]
with patch.object(brain,'ask_ai',return_value=(['0: Oh','1: my','2: God.'],'model',0)):
 fixed=brain.fix_caption_words(original);assert [w['w'] for w in fixed]==['Oh','my','God.'],fixed
 assert [(w['s'],w['e']) for w in fixed]==[(w['s'],w['e']) for w in original]
with patch.object(brain,'ask_ai',return_value=(['12','my','God.'],'model',0)):
 assert brain.fix_caption_words(original)[0]['w']=='oh'
assert brain._without_row_label('1.5',1)=='1.5' and brain._without_row_label('3:21',3)=='3:21'
assert brain._same_word('eleven','11') and not brain._same_word('oh','3: Oh')
print('PASS input row labels are removed, spoken numbers preserved and invented numbers refused')
os.environ['PEAKCUT_CAPTION_MODEL']='test-local-model'
with ctx.as_user(u.id):
 j.update(source_path=str(source),width=360,height=640,duration=44,clips=[dict(clip,score=90,title='Test',description='',hashtags=[],hook='',version=1,start=2.15,end=8.15,captions=True)])
 item=j['clips'][0];(Path(j['dir'])/'clips').mkdir(exist_ok=True)
 with patch.object(captions,'available',return_value=True),patch.object(captions,'transcribe_clip',return_value=([{'w':'hello','s':0.5,'e':1.0}],'en')),patch.object(render,'render_clip',return_value={'file':'test.mp4','cover':'test.jpg'}) as draw,patch.object(jobs,'save'):
  jobs.render_one(j,item,original)
 assert item['fixed_words'][0]['s']==2.65 and draw.call_args.args[4][0]['s']==2.65
 assert item['caption_source']=='local-whisper' and item['status']=='done'
print('PASS multilingual clip-local timestamps map once onto the render timeline')
