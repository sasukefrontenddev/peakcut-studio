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
