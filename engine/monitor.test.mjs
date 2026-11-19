import test from 'node:test';
import assert from 'node:assert/strict';
import {createMonitor,summarize} from './monitor.mjs';

test('public gateway never proxies engine APIs or accepts writes; stats require their own key',async()=>{
 let calls=0;
 const responses={'/api/overview':{creators:[{clips_total:4,posted_total:2,queued:1,failed:0,drafts:1}],posts:[],daily:[]},'/api/jobs':[], '/api/accounts':[{platform:'youtube',name:'Channel',token:'never-share',secret:'never-share'}],'/api/creators':[]};
 const server=createMonitor({token:'read-only-test',fetcher:async u=>{calls++;return{ok:true,json:async()=>responses[u.pathname]};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(url+'/')).status,200);
  assert.equal((await fetch(url+'/status')).status,401);
  assert.equal((await fetch(url+'/status?token=read-only-test')).status,404);
  assert.equal((await fetch(url+'/api/accounts')).status,404);
  assert.equal((await fetch(url+'/status',{method:'POST',headers:{Authorization:'Bearer read-only-test'}})).status,404);
  assert.equal(calls,0);
  const r=await fetch(url+'/status',{headers:{Authorization:'Bearer read-only-test'}});const body=await r.text();const d=JSON.parse(body);
  assert.equal(d.totals.clips,4);assert.equal(d.totals.drafts,1);assert.ok(!body.includes('never-share'));
  await fetch(url+'/status',{headers:{Authorization:'Bearer read-only-test'}});assert.equal(calls,4);
 }finally{await new Promise(r=>server.close(r));}
});

test('engine failure is explicit and does not turn old values into fresh data',async()=>{
 let time=100000,fail=false;
 const server=createMonitor({token:'test',now:()=>time,fetcher:async()=>{if(fail)throw Error('token-secret-stacktrace');return{ok:true,json:async()=>[]};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/status';
 try{
  const options={headers:{Authorization:'Bearer test'}};const first=await(await fetch(url,options)).json();
  time+=30000;fail=true;const next=await(await fetch(url,options)).json();assert.equal(next.online,false);assert.equal(next.updated_at,first.updated_at);assert.ok(!JSON.stringify(next).includes('secret'));
 }finally{await new Promise(r=>server.close(r));}
});

test('recording controls require their separate key and only address configured live creators',async()=>{
 const time=2000000, calls=[];let recording=false;
 const creator=()=>({id:'creator-one',name:'Creator One',channels:{youtube:'https://youtube.com/@one'},profiles:{youtube:{channel:'https://youtube.com/@one',live:true,live_at:time/1000}},live_job:recording?'live-job':null});
 const server=createMonitor({token:'view-key',controlToken:'control-key',now:()=>time,fetcher:async(u,o={})=>{
  calls.push([u.pathname,o.method||'GET']);let data;
  if(u.pathname==='/api/creators')data=[creator()];
  else if(u.pathname==='/api/accounts')data=[];
  else if(u.pathname==='/api/jobs')data=recording?[{id:'live-job',creator:'creator-one',status:'live'}]:[];
  else if(u.pathname==='/api/creators/creator-one/live'){recording=true;data={id:'live-job'};}
  else if(u.pathname==='/api/live/live-job/stop'){recording=false;data={ok:true};}
  else data={creators:[],posts:[],daily:[]};return{ok:true,json:async()=>data};
 }});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const command=(id,action,key='control-key',origin)=>fetch(base+'/control/creators/'+id+'/'+action,{method:'POST',headers:{Authorization:'Bearer '+key,...(origin?{Origin:origin}:{})}});
 try{
  assert.equal((await command('creator-one','start','view-key')).status,401);assert.equal(calls.length,0);
  assert.equal((await command('creator-one','start','control-key','https://evil.example')).status,403);assert.equal(calls.length,0);
  assert.equal((await command('missing','start')).status,404);
  assert.equal((await command('creator-one','delete')).status,404);
  assert.equal((await command('creator-one','start')).status,200);assert.equal(recording,true);
  assert.equal((await command('creator-one','start')).status,409);
  assert.equal((await command('creator-one','stop')).status,200);assert.equal(recording,false);
  assert.deepEqual(calls.filter(c=>c[1]==='POST'),[['/api/creators/creator-one/live','POST'],['/api/live/live-job/stop','POST']]);
  const view=await(await fetch(base+'/status',{headers:{Authorization:'Bearer view-key'}})).json();assert.equal(view.can_control,false);assert.equal(view.creators[0].live,true);
  assert.ok(!JSON.stringify(view).includes('control-key'));
 }finally{await new Promise(r=>server.close(r));}
});

test('stale live signals cannot initiate recording',async()=>{
 const server=createMonitor({token:'view',controlToken:'control',now:()=>1000000,fetcher:async()=>({ok:true,json:async()=>[{id:'old',channels:{youtube:'https://youtube.com/@old'},profiles:{youtube:{channel:'https://youtube.com/@old',live:true,live_at:1}}}]})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/control/creators/old/start',{method:'POST',headers:{Authorization:'Bearer control'}});assert.equal(r.status,409);
 }finally{await new Promise(r=>server.close(r));}
});

test('calendar is read-only, authenticated, constrained and forwards only calendar parameters',async()=>{
 const calls=[];const server=createMonitor({token:'calendar-key',controlToken:'control-key',fetcher:async u=>{calls.push(u);return{ok:true,json:async()=>({start:'2026-11-01',posts:[],totals:{posted:0}})};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const query='/calendar?start=2026-11-01&end=2026-12-01&time_zone=Asia%2FDubai';
  assert.equal((await fetch(base+query)).status,401);assert.equal(calls.length,0);
  assert.equal((await fetch(base+query,{headers:{Authorization:'Bearer calendar-key'}})).status,200);
  assert.equal(calls[0].pathname,'/api/posts/calendar');assert.equal(calls[0].searchParams.get('time_zone'),'Asia/Dubai');
  assert.equal((await fetch(base+query+'&url=https://example.com',{headers:{Authorization:'Bearer control-key'}})).status,400);
  assert.equal((await fetch(base+query,{method:'POST',headers:{Authorization:'Bearer control-key'}})).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));server.closeAllConnections();}
});
