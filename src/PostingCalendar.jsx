import {useEffect, useMemo, useState} from 'react';
import {CalendarDays, ChevronLeft, ChevronRight, RefreshCw} from 'lucide-react';
import {api} from './api';
import './calendar.css';
const platforms={youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook'};
const states={scheduled:'Scheduled',posting:'Uploading',posted:'Published',failed:'Failed',needs_action:'Finish in TikTok'};
const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const stats=rows=>({clips:new Set(rows.map(p=>`${p.job}/${p.clip}`)).size,uploads:rows.length,...Object.fromEntries(Object.keys(states).map(s=>[s,rows.filter(p=>p.status===s).length]))});
export default function PostingCalendar({revision}) {
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [selected,setSelected]=useState(()=>dateKey(new Date()));
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[platform,setPlatform]=useState('all'),[status,setStatus]=useState('all'),[reload,setReload]=useState(0);
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 const start=dateKey(month),end=dateKey(new Date(month.getFullYear(),month.getMonth()+1,1));
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  api(`/posts/calendar?${new URLSearchParams({start,end,time_zone:zone})}`,{signal:controller.signal})
   .then(d=>{if(!controller.signal.aborted)setData(d);})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[start,end,zone,revision,reload]);
 const current=data?.start===start&&data?.end===end?data:null;
 const rows=useMemo(()=>(current?.posts||[]).filter(p=>(platform==='all'||p.platform===platform)&&(status==='all'||p.status===status)),[current,platform,status]);
 const totals=stats(rows),dayRows=rows.filter(p=>p.day===selected),dayStats=stats(dayRows);
 const first=(month.getDay()+6)%7,days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const cells=Array.from({length:Math.ceil((first+days)/7)*7},(_,i)=>i-first+1);
 const grouped=new Map();for(const p of rows){if(!grouped.has(p.day))grouped.set(p.day,[]);grouped.get(p.day).push(p);}
 function move(delta){const d=new Date(month.getFullYear(),month.getMonth()+delta,1);setMonth(d);setSelected(dateKey(d));}
 function today(){const d=new Date();setMonth(new Date(d.getFullYear(),d.getMonth(),1));setSelected(dateKey(d));}
 return <section className="panel posting-calendar" aria-label="Posting calendar">
  <div className="calendar-heading"><div><span className="calendar-eyebrow"><CalendarDays size={15}/> YOUR POSTING PLAN</span><h2>Every clip. Its place in time.</h2><p>Scheduled uploads and actual publishing results · {zone.replaceAll('_',' ')}</p></div><button className="button outline" onClick={()=>setReload(n=>n+1)} disabled={loading} aria-label="Refresh calendar"><RefreshCw size={16}/> Refresh</button></div>
  <div className="calendar-tools"><div className="calendar-month"><button onClick={()=>move(-1)} aria-label="Previous month"><ChevronLeft size={20}/></button><h3 aria-live="polite">{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><button onClick={()=>move(1)} aria-label="Next month"><ChevronRight size={20}/></button><button className="calendar-today" onClick={today}>Today</button></div><div className="calendar-filters"><label>Platform<select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="all">All platforms</option>{Object.entries(platforms).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{Object.entries(states).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div></div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="calendar-stats" aria-label="Month totals">{[['Generated',current?.totals.generated||0],['Unique clips to post',totals.clips],['Scheduled',totals.scheduled],['Published',totals.posted],['TikTok drafts',totals.needs_action],['Failed',totals.failed]].map(([label,value])=><div key={label}><strong>{current?value:'—'}</strong><span>{label}</span></div>)}</div>
  <div className="calendar-platforms">{Object.entries(platforms).map(([id,name])=>{const s=stats(rows.filter(p=>p.platform===id));return <div key={id} className={`calendar-platform ${id}`}><i/><strong>{name}</strong><span>{s.scheduled} scheduled · {s.posted} published{s.needs_action?` · ${s.needs_action} drafts`:''}{s.failed?` · ${s.failed} failed`:''}</span></div>;})}</div>
  <div className="calendar-body" aria-busy={loading}><div><div className="calendar-weekdays" aria-hidden="true">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span key={d}>{d}</span>)}</div><div className="calendar-grid">{cells.map((n,i)=>{
   if(n<1||n>days)return <div className="calendar-blank" key={`blank-${i}`}/>;
   const key=`${start.slice(0,8)}${String(n).padStart(2,'0')}`,ps=grouped.get(key)||[],s=stats(ps),generated=current?.days.find(d=>d.day===key)?.generated||0;
   return <button key={key} className={`calendar-day ${selected===key?'selected':''} ${dateKey(new Date())===key?'is-today':''}`} aria-pressed={selected===key} aria-label={`${new Date(month.getFullYear(),month.getMonth(),n).toLocaleDateString(undefined,{dateStyle:'full'})}, ${s.clips} clips, ${s.scheduled} scheduled, ${s.posted} published`} onClick={()=>setSelected(key)}><span className="calendar-day-number">{n}</span>{generated>0&&<span className="calendar-generated">{generated} made</span>}{ps.length>0&&<><strong>{s.clips} <span>{s.clips===1?'clip':'clips'}</span></strong><span className="calendar-day-count">{ps.length} {ps.length===1?'upload':'uploads'}</span><div className="calendar-dots">{Object.keys(platforms).filter(p=>ps.some(r=>r.platform===p)).map(p=><i key={p} className={p} title={platforms[p]}/>)}</div>{s.failed>0&&<span className="calendar-day-failed">{s.failed} failed</span>}</>}</button>;
  })}</div></div>
  <aside className="calendar-agenda"><span className="calendar-eyebrow">DAY AT A GLANCE</span><h3>{new Date(`${selected}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</h3><p>{current?.days.find(d=>d.day===selected)?.generated||0} generated · {dayStats.clips} unique clips · {dayStats.uploads} platform uploads</p><p className="calendar-small">{dayStats.scheduled} scheduled · {dayStats.posted} published · {dayStats.needs_action} TikTok drafts · {dayStats.failed} failed</p>
   {loading&&!current?<p role="status">Loading your calendar…</p>:dayRows.length===0?<div className="calendar-empty"><CalendarDays size={28}/><strong>A little breathing room.</strong><p>{platform!=='all'||status!=='all'?'No uploads match these filters.':'No scheduled uploads or publishing results for this day.'}</p></div>:<div className="calendar-agenda-list">{dayRows.map(p=><article className="calendar-post" key={p.id}><div className="calendar-post-top"><span className={`calendar-pill ${p.platform}`}>{platforms[p.platform]||p.platform}</span><time dateTime={new Date(p.at*1000).toISOString()}>{new Date(p.at*1000).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</time></div><h4>{p.title||'Untitled clip'}</h4><p>{p.creator_name} · {p.account_name}</p><span className={`calendar-state ${p.status}`}>{states[p.status]||p.status}</span>{p.status==='failed'&&p.error&&<p className="form-error">{p.error}</p>}{p.status==='needs_action'&&<p className="calendar-small">Delivered to TikTok’s inbox. Open TikTok to finish posting.</p>}{p.url&&<a href={p.url} target="_blank" rel="noreferrer">View published post ↗</a>}</article>)}</div>}
  </aside></div><p className="calendar-footnote">Generated counts successfully made, saved clips across all creators, regardless of platform filter. One clip sent to three platforms counts as one unique clip and three uploads. Published dates use actual success times; drafts are not published. Cancelled queue entries are excluded. History includes posts you later deleted.</p>
 </section>;
}
