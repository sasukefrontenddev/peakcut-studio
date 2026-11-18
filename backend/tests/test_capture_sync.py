"""Split live tracks with different live-edge starts retain their common source clock."""
import os,sys,tempfile,subprocess,json
from pathlib import Path
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(prefix='capture-sync-'),PEAKCUT_FETCH_MODEL='0')
sys.path.insert(0,'.')
import numpy as np
from studio import live,tools
assert not tools.setup()
r=Path(os.environ['PEAKCUT_DATA']);v=r/'video.ts';a=r/'audio.ts'
def run(args):subprocess.run(['ffmpeg','-y','-v','error',*args],check=True)
run(['-f','lavfi','-i',"color=black:s=160x160:r=30:d=10,drawbox=color=white:t=fill:enable='between(t,3,3.2)'",'-an','-c:v','libx264','-threads','2','-g','30','-bf','0','-output_ts_offset','100','-mpegts_copyts','1','-muxdelay','0',str(v)])
run(['-f','lavfi','-i',r'aevalsrc=if(between(t\,1\,1.2)\,0.7*sin(2*PI*1000*t)\,0):s=48000:d=8','-c:a','aac','-output_ts_offset','102','-mpegts_copyts','1','-muxdelay','0',str(a)])
for corrected in [False,True]:
 out=r/('fixed.ts' if corrected else 'old.ts')
 inputs=live.capture_inputs([str(v),str(a)]) if corrected else ['-i',str(v),'-i',str(a)]
 run([*inputs,'-map','0:v:0','-map','1:a:0','-c','copy',str(out)])
 video=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(out),'-an','-vf','scale=1:1,format=gray','-f','rawvideo','pipe:1']),dtype=np.uint8)
 meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(out)]))
 origin=float(meta['format']['start_time']);audio_start=float(next(s['start_time'] for s in meta['streams'] if s['codec_type']=='audio'))-origin
 audio=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-copyts','-start_at_zero','-i',str(out),'-vn','-ac','1','-ar','48000','-af','aresample=async=1:first_pts=0','-f','f32le','pipe:1']),dtype=np.float32)
 visual=np.where(video>150)[0][0]/30
 energy=np.sqrt(np.mean(audio[:len(audio)//480*480].reshape(-1,480)**2,axis=1));sound=np.where(energy>max(energy)*0.4)[0][0]/100
 sound += audio_start
 delta=visual-sound
 print('MEASURE',corrected,visual,sound,delta,flush=True)
 if corrected:assert abs(delta)<0.08,(visual,sound)
 else:assert delta>1.8,(visual,sound)
print('PASS reproduces two-second early audio in old ingest and fixes split-input source clock alignment')
# Exercise the clip renderer too, not just packet timestamps in the intermediate mux.
from studio import render
render.W,render.H=360,640;render._qsv_ok=False;render.install_fonts()
result=render.render_clip(r/'fixed.ts',r/'clips','sync',{'start':2.5,'end':6,'layout':'crop','captions':False},[],160,160)
out=r/'clips'/result['file']
video=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(out),'-an','-vf','scale=1:1,format=gray','-f','rawvideo','pipe:1']),dtype=np.uint8)
audio=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(out),'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1']),dtype=np.float32)
visual=np.where(video>150)[0][0]/30
energy=np.sqrt(np.mean(audio[:len(audio)//480*480].reshape(-1,480)**2,axis=1));sound=np.where(energy>max(energy)*0.4)[0][0]/100
assert abs(visual-sound)<0.06,(visual,sound)
assert abs(visual-0.5)<0.06,visual
print('PASS split live capture through actual final clip render preserves flash/beep sync',visual,sound)
