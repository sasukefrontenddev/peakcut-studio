# Posting calendar

Open **Publishing** in PeakCut Studio. Use the arrows to choose a month, select a day,
and filter by platform or status. Daily details list clip titles, creators, destination
accounts, local times, results and published-post links. The private phone monitor also
has a month calendar and platform filter.

- Generated: currently saved clips made in that period, across all creators. Deleted
  clips are no longer counted. Platform filters apply to uploads, not generation.
- Unique clips: distinct job/clip pairs with an upload in the selected period.
- Uploads: each destination counts once. One clip on three platforms is three uploads.
- Published: successful API publishing history, dated by its actual success time.
  History includes posts later removed on the social platform.
- TikTok inbox delivery is **Finish in TikTok**, not published.
- Scheduled and failed items use their planned queue date. Cancelled items are excluded.

Dates use the viewing browser's time zone, displayed above the calendar. Month queries
use that same zone, including daylight-saving transitions. This endpoint reads the full
posting history, rather than the dashboard's last 15 results. It is owner-scoped; the
remote endpoint requires an existing private monitor or control key and is read-only.

A calendar entry is a stored plan/result, not a guarantee a future upload will succeed.
The computer must keep the engine running for publishing and live remote updates.
