"""Queued clips and active scouting keep their source; missing footage is not blindly retried."""
import os,sys,tempfile
from pathlib import Path
from unittest.mock import patch
os.environ.update(PEAKCUT_DATA=tempfile.mkdtemp(),PEAKCUT_FETCH_MODEL='0',PEAKCUT_ACCOUNTS='0',DATABASE_URL='')
sys.path.insert(0,'.')
from studio import live,creators,jobs
root=Path(os.environ['PEAKCUT_DATA']);folder=root/'session';folder.mkdir()
job={'id':'test','dir':str(folder),'clips':[],'creator':'test','source':{'url':'https://example.invalid'},'width':1280,'height':720}
s=live.Session(job,dict(creators.DEFAULTS,buffer_min=5));s.seg_clock=1000
pieces=[]
for n,a in enumerate([0,10,20,30,700,710,990]):
 p=s.buf/f'{n}.ts';p.write_bytes(b'source');pieces.append((p,a,a+10))
s.segments=pieces
job['clips']=[{'id':'old','start':12,'end':18,'status':'queued'}]
s.analysis_range=(25,28)
s._scan_segments()
assert pieces[0][0].exists() and pieces[1][0].exists() and pieces[2][0].exists() and pieces[3][0].exists()
job['clips'][0]['status']='done';s.analysis_range=None;s._scan_segments()
assert not any(p[0].exists() for p in pieces[:4]) and pieces[-1][0].exists()
print('PASS queued clip and in-flight analysis retention, release after completion')
# A gap through the middle must fail rather than concatenate the wrong footage into a plausible clip.
c={'id':'gap','start':705,'end':730,'status':'queued'};s.segments=[(pieces[4][0],700,710),(pieces[-1][0],990,1000)];s.ended=True
with patch.object(jobs,'save'),patch.object(jobs,'render_one') as render:
 s._render(c);assert c['status']=='error' and c['retryable'] is False and c['error_kind']=='source_expired';render.assert_not_called()
# Already materialized footage survives restart even when the rolling buffer no longer contains it.
saved=root/'saved.ts';saved.write_bytes(b'saved');c={'id':'saved','src':str(saved)}
with patch.object(jobs,'render_one') as render:s._render(c);render.assert_called_once()
print('PASS missing-span coverage check and reuse of saved source after restart')
# A protected old piece must not cause the audio analyzer to stay hours behind the rolling live edge.
s.segments=[(saved,0,10),(pieces[-1][0],990,1000)];s.samples=live.SR*1000;s.pending=bytearray(live.SR*2*1000);s.pending_base=0
with patch.object(live.transcribe,'transcribe') as transcribe:
 assert s._transcribe_step();transcribe.assert_not_called();assert s.pending_base>=live.SR*990
print('PASS expired analysis backlog skips to retained live footage rather than producing impossible clips')
