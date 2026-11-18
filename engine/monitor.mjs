import http from 'node:http';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const dashboard=readFileSync(new URL('./monitor.html',import.meta.url),'utf8');

export function summarize(overview, jobs, accounts, creators, now = Date.now()) {
  const rows = overview.creators || [];
  const sum = key => rows.reduce((n,r)=>n+(Number(r[key])||0),0);
  const posts = overview.posts || [];
  return {
    version: 1, updated_at: new Date(now).toISOString(), online: true,
    paused: !!overview.paused,
    totals: { clips:sum('clips_total'), posted:sum('posted_total'), queued:sum('queued'),
      failed:sum('failed'), drafts:sum('drafts'),
      active:jobs.filter(j=>['queued','running','live'].includes(j.status)).length,
      creators:creators.length, auto_post:rows.filter(r=>r.autopost).length,
      watching:creators.filter(c=>c.auto_watch).length, recording:Number(overview.recording)||0,
      clips_today:sum('clips_today'), posted_today:sum('posted_today'), views:sum('views') },
    platforms:['youtube','instagram','tiktok'].map(platform=>({
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

export function createMonitor({token, backendURL='http://127.0.0.1:8765', fetcher=fetch, now=Date.now}) {
  const origin=new URL(backendURL);
  if(origin.protocol!=='http:'||!['localhost','127.0.0.1'].includes(origin.hostname)) throw Error('Local engine required');
  let cache=null, lastAttempt=0, pending=null;
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
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(dashboard);return;
    }
    if(req.url!=='/status'||req.method!=='GET'){res.writeHead(404).end();return;}
    const supplied=Buffer.from(req.headers.authorization||'');const wanted=Buffer.from('Bearer '+token);
    if(!token||supplied.length!==wanted.length||!timingSafeEqual(supplied,wanted)){res.writeHead(401).end();return;}
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(await load()));
  });
}

export async function startMonitor({root,cloudflared,port=8770}) {
  const privateFile=resolve(root,'.widget-connection.json');
  const old=existsSync(privateFile)?JSON.parse(readFileSync(privateFile,'utf8')):{};
  const token=old.token||randomBytes(32).toString('hex');
  const server=createMonitor({token});
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
  const persist=(url='',error='')=>{writeFileSync(privateFile+'.tmp',JSON.stringify({url,token,error,updated_at:new Date().toISOString()}),{mode:0o600});renameSync(privateFile+'.tmp',privateFile);};
  persist('','Starting read-only widget connection');
  const child=spawn(cloudflared,['tunnel','--no-autoupdate','--url',`http://127.0.0.1:${port}`,'--protocol','http2','--metrics','127.0.0.1:0'],{stdio:['ignore','pipe','pipe']});
  let url='';
  const read=bytes=>{const match=String(bytes).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(match&&!url){url=match[0];persist(url);console.log('Protected read-only widget connection ready. Private setup is in .widget-connection.json.');}};
  child.stdout.on('data',read);child.stderr.on('data',read);
  child.on('error',()=>persist('','Widget tunnel could not start'));
  child.on('exit',()=>{persist('','Widget connection stopped');server.close();});
  return {stop(){child.kill();server.close();server.closeAllConnections();persist('','Widget connection stopped');}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const local=JSON.parse(readFileSync(resolve(root,'.engine-local.json'),'utf8'));
  const monitor=await startMonitor({root,cloudflared:local.cloudflared});
  for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{monitor.stop();process.exit(0);});
}
