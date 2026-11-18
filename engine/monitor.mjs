import http from 'node:http';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const dashboardFile=new URL('./monitor.html',import.meta.url);

function liveCreator(c, jobs, accounts, now) {
  const profiles=Object.values(c.profiles||{}).filter(p=>Object.values(c.channels||{}).includes(p.channel));
  const recent=profiles.filter(p=>Number(p.live_at)>0&&now/1000-Number(p.live_at)<180);
  const onAir=recent.find(p=>p.live);
  const job=jobs.find(j=>j.id===c.live_job&&j.creator===c.id);
  const destinations=accounts.filter(a=>(c.accounts||[]).includes(a.id)).map(a=>({platform:a.platform,name:String(a.name).slice(0,80)}));
  return {id:c.id,name:String(c.name).slice(0,100),live:!!onAir,known:recent.length>0,
    checked_at:Math.max(0,...profiles.map(p=>Number(p.live_at)||0)),title:String(onAir?.title||'').slice(0,180),
    recording:!!c.live_job,stage:String(job?.stage||'').slice(0,120),
    error:job?.status==='error'?'Recording failed. Check the local workspace.':'',
    can_start:!!onAir&&!c.live_job,autopost:!!c.autopost&&destinations.length>0,destinations,
    min_score:Number(c.post_min_score)||0,daily_cap:Number(c.daily_cap)||0,post_gap_min:Number(c.post_gap_min)||0};
}

export function summarize(overview, jobs, accounts, creators, now = Date.now()) {
  const rows = overview.creators || [];
  const sum = key => rows.reduce((n,r)=>n+(Number(r[key])||0),0);
  const posts = overview.posts || [];
  return {
    version: 1, updated_at: new Date(now).toISOString(), online: true,
    paused: !!overview.paused,
    creators:creators.map(c=>liveCreator(c,jobs,accounts,now)),
    totals: { clips:sum('clips_total'), posted:sum('posted_total'), queued:sum('queued'),
      failed:sum('failed'), drafts:sum('drafts'),
      active:jobs.filter(j=>['queued','running','live'].includes(j.status)).length,
      creators:creators.length, auto_post:rows.filter(r=>r.autopost).length,
      watching:creators.filter(c=>c.auto_watch).length, recording:Number(overview.recording)||0,
      clips_today:sum('clips_today'), posted_today:sum('posted_today'), views:sum('views') },
    platforms:['youtube','instagram','tiktok','facebook'].map(platform=>({
      platform, connected:accounts.some(a=>a.platform===platform),
      accounts:accounts.filter(a=>a.platform===platform).map(a=>String(a.name).slice(0,80)),
      recent_posted:posts.filter(p=>p.platform===platform&&p.status==='posted').length,
      queued:posts.filter(p=>p.platform===platform&&['scheduled','posting'].includes(p.status)).length,
      failed:posts.filter(p=>p.platform===platform&&p.status==='failed').length,
      drafts:posts.filter(p=>p.platform===platform&&p.status==='needs_action').length,
      last_post:Math.max(0,...posts.filter(p=>p.platform===platform&&p.status==='posted').map(p=>p.posted_at||0)),
      note:platform==='tiktok'?'Public Direct Post requires TikTok review':''})),
    daily:(overview.daily||[]).slice(-14).map(d=>({day:d.day,clips:Number(d.clips)||0,posted:Number(d.posted)||0})),
    activity:posts.slice(0,4).map(p=>({platform:p.platform,status:p.status,at:p.posted_at||p.due_at||0})),
    note:'Clips counts saved clips; posts counts successful upload history, including posts later removed. Account connection does not prove future uploads will succeed.'
  };
}

export function createMonitor({token, controlToken='', backendURL='http://127.0.0.1:8765', fetcher=fetch, now=Date.now}) {
  const origin=new URL(backendURL);
  if(origin.protocol!=='http:'||!['localhost','127.0.0.1'].includes(origin.hostname)) throw Error('Local engine required');
  let cache=null, lastAttempt=0, pending=null;
  const busy=new Set();
  const authorized=(supplied,secret)=>{const a=Buffer.from(supplied||''),b=Buffer.from('Bearer '+secret);return !!secret&&a.length===b.length&&timingSafeEqual(a,b);};
  const engine=async(path,method='GET')=>{const r=await fetcher(new URL(path,origin),{method,
    ...(method==='POST'?{headers:{'Content-Type':'application/json',Origin:origin.origin},body:'{}'}:{}),signal:AbortSignal.timeout(15000)});
    const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail.slice(0,240):'The engine rejected this recording request.');return data;};
  const load=async()=>{
    if(cache&&now()-lastAttempt<15000)return cache;
    if(pending)return pending;
    lastAttempt=now();
    pending=(async()=>{
      try{
        const values=await Promise.all(['/api/overview','/api/jobs','/api/accounts','/api/creators'].map(async p=>{
          const r=await fetcher(new URL(p,origin),{signal:AbortSignal.timeout(7000)});
          if(!r.ok)throw Error('Engine unavailable');return r.json();
        }));
        cache=summarize(...values,now());
      }catch{
        cache={...(cache||{version:1}),online:false,checked_at:new Date(now()).toISOString()};
      }finally{pending=null;}
      return cache;
    })();return pending;
  };
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    if(req.url==='/'&&req.method==='GET'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(readFileSync(dashboardFile,'utf8'));return;
    }
    const command=/^\/control\/creators\/([\w-]{1,60})\/(start|stop)$/.exec(req.url||'');
    if(command&&req.method==='POST'){
      if(!authorized(req.headers.authorization,controlToken)){res.writeHead(401).end();return;}
      if(req.headers.origin&&!['https://'+req.headers.host,'http://'+req.headers.host].includes(req.headers.origin)){res.writeHead(403).end();return;}
      if(Number(req.headers['content-length']||0)>1024||req.headers['transfer-encoding']){res.writeHead(413).end();return;}
      const [,id,action]=command;
      if(busy.has(id)){res.writeHead(409).end();return;}
      busy.add(id);
      try{
        const creators=await engine('/api/creators');const creator=creators.find(c=>c.id===id);
        if(!creator){res.writeHead(404).end();return;}
        if(action==='start'){
          if(creator.live_job){res.writeHead(409).end(JSON.stringify({error:'This creator is already recording.'}));return;}
          if(!liveCreator(creator,[],[],now()).can_start){res.writeHead(409).end(JSON.stringify({error:'No recent live signal. Refresh and try again when this creator is live.'}));return;}
          const job=await engine('/api/creators/'+id+'/live','POST');
          res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,action,job_id:job.id}));
        }else{
          const jobs=await engine('/api/jobs');
          if(!creator.live_job||!jobs.some(j=>j.id===creator.live_job&&j.creator===id&&j.status==='live')){res.writeHead(409).end(JSON.stringify({error:'This creator has no active recording.'}));return;}
          await engine('/api/live/'+encodeURIComponent(creator.live_job)+'/stop','POST');
          res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,action}));
        }
        cache=null;lastAttempt=0;
      }catch(e){res.writeHead(502,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}));}
      finally{busy.delete(id);}return;
    }
    if(req.url!=='/status'||req.method!=='GET'){res.writeHead(404).end();return;}
    const controller=authorized(req.headers.authorization,controlToken);
    if(!controller&&!authorized(req.headers.authorization,token)){res.writeHead(401).end();return;}
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({...await load(),can_control:controller}));
  });
}

export async function startMonitor({root,cloudflared,port=8770,remoteControl=false}) {
  const privateFile=resolve(root,'.widget-connection.json');
  const old=existsSync(privateFile)?JSON.parse(readFileSync(privateFile,'utf8')):{};
  const token=old.token||randomBytes(32).toString('hex');
  const controlToken=remoteControl?(old.controlToken||randomBytes(32).toString('hex')):'';
  const server=createMonitor({token,controlToken});
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
  const persist=(url='',error='')=>{writeFileSync(privateFile+'.tmp',JSON.stringify({url,token,...(controlToken?{controlToken}:{}),error,updated_at:new Date().toISOString()}),{mode:0o600});renameSync(privateFile+'.tmp',privateFile);};
  persist('','Starting protected monitor connection');
  const child=spawn(cloudflared,['tunnel','--no-autoupdate','--url',`http://127.0.0.1:${port}`,'--protocol','http2','--metrics','127.0.0.1:0'],{stdio:['ignore','pipe','pipe']});
  let url='';
  const read=bytes=>{const match=String(bytes).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(match&&!url){url=match[0];persist(url);console.log('Protected monitor connection ready. Private setup is in .widget-connection.json.');}};
  child.stdout.on('data',read);child.stderr.on('data',read);
  child.on('error',()=>persist('','Widget tunnel could not start'));
  child.on('exit',()=>{persist('','Widget connection stopped');server.close();});
  return {stop(){child.kill();server.close();server.closeAllConnections();persist('','Widget connection stopped');}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const local=JSON.parse(readFileSync(resolve(root,'.engine-local.json'),'utf8'));
  const monitor=await startMonitor({root,cloudflared:local.cloudflared,remoteControl:local.remoteControl===true});
  for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{monitor.stop();process.exit(0);});
}
