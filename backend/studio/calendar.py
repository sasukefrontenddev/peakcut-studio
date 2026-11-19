"""Owner-scoped posting calendar; uses full history instead of the dashboard's recent-results sample."""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from . import posting, creators, jobs

STATES = ('scheduled', 'posting', 'posted', 'failed', 'needs_action')
PLATFORMS = ('youtube', 'instagram', 'tiktok', 'facebook')


def read(start, end, time_zone='UTC'):
    try:
        first, stop = date.fromisoformat(start), date.fromisoformat(end)
        zone = ZoneInfo(time_zone)
        if not 0 < (stop-first).days <= 62:
            raise ValueError()
    except (ValueError, TypeError, ZoneInfoNotFoundError):
        raise ValueError('Choose a valid calendar range of up to 62 days and a valid time zone.') from None
    lo, hi = (datetime.combine(d, time.min, zone).timestamp() for d in (first, stop))
    names = {c['id']:c['name'] for c in creators.all_creators()}
    rows = []
    for p in list(posting._mine()):
        if p['status'] not in STATES:
            continue
        at = (p.get('posted_at') if p['status']=='posted' else p.get('uploaded_at') if p['status']=='needs_action' else None) or p.get('due_at', 0)
        if not lo <= at < hi:
            continue
        rows.append({**{k:p.get(k) for k in ('id','job','clip','creator','account_name','platform','status','title','score','url','error','note','views','due_at','posted_at','uploaded_at')},
                     'creator_name':names.get(p['creator'], ''), 'at':at,
                     'day':datetime.fromtimestamp(at, zone).date().isoformat()})
    rows.sort(key=lambda p:(p['at'], p['id']))
    generated = {}
    for job in jobs.list_jobs():
        for clip in job.get('clips', []):
            at = clip.get('made_at') or 0
            if (clip.get('status') == 'done' or clip.get('version', 0) > 0) and lo <= at < hi:
                day = datetime.fromtimestamp(at, zone).date().isoformat()
                generated[day] = generated.get(day, 0) + 1
    days = []
    for i in range((stop-first).days):
        day = (first+timedelta(days=i)).isoformat()
        ps = [p for p in rows if p['day']==day]
        days.append({'day':day, 'generated':generated.get(day,0), **counts(ps), 'platforms':{name:counts([p for p in ps if p['platform']==name]) for name in PLATFORMS}})
    return {'start':start,'end':end,'time_zone':time_zone,'posts':rows,'days':days,
            'totals':dict(counts(rows),generated=sum(generated.values())),'platforms':{name:counts([p for p in rows if p['platform']==name]) for name in PLATFORMS}}


def counts(rows):
    return {'clips':len({(p['job'],p['clip']) for p in rows}), 'uploads':len(rows),
            **{s:sum(p['status']==s for p in rows) for s in STATES},
            'views':sum(p.get('views') or 0 for p in rows if p['status']=='posted')}
