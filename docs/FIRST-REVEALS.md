# First reveals and reliable live clipping

Choose **Creators → creator settings → Moment selection → Landmarks and first reveals**.
This uses the optional local Qwen vision model rather than ordinary transcript/reaction
scouting. Quiet visual moments can qualify without shouting or a chat spike.

The scout periodically reads two frames, 14 seconds apart. Both must clearly show the
same supported major location or vehicle, at confidence 90 or higher. It ignores ordinary
roads, vague buildings, facecam, chat, subtitles and menus. Supported topics include
airports, beaches, bridges, ports, stations, stadiums, hospitals, police stations, skylines,
hotels and major vehicles. Each category is selected once per recording. It means
**first detected in this recording**, never the streamer's first-ever visit. Periodic
sampling and a small local model can miss fast events or misclassify scenes; evidence
frames are retained privately in each recording's `landmark-evidence` folder.

The selected clip contains context before the observed reveal and a short continuation.
The actual clip audio still gets the local multilingual subtitle pass. The verified
scene description is kept even if spoken dialogue happens to concern another subject.
Creator hashtags and the normal destination-specific posting schedule remain in effect.
The reaction quota does not suppress a distinct first landmark; category deduplication
prevents repeated views of the same location type. Manual clipping remains available.

The Mac installation uses `qwen3-vl:2b-instruct` through local Ollama (about 1.9 GB).
Set `PEAKCUT_VISION_MODEL` or the ignored engine config's `visionModel` field. Pull the
model with `ollama pull qwen3-vl:2b-instruct`. Images are sent only to localhost, never a
cloud model or paid API. CPU, RAM and inference concurrency checks protect the engine.

## Source retention

The rolling buffer now protects pieces needed by queued clips and in-flight analysis.
Saved clip source files are reused after restart. Old unanalysed audio whose video has
expired is skipped rather than used to select impossible clips. Gaps in required footage
are rejected rather than silently concatenated into a wrong video. macOS CPU and memory
measurements use psutil; the Linux-only sampler no longer silently disables the guard.

A clip whose original footage already expired cannot be recreated from missing bytes.
It stays visible with a source-expired explanation and no misleading re-make action.
Restoration would require the original full recording/VOD; this change does not invent
or substitute another part of a stream. Calendar generated totals exclude failed or
queued candidates that never produced a video.

Existing reaction-based queued uploads can be cancelled without deleting their clips.
When a creator uses first-reveal mode, any old reaction render finishing after a restart
is not automatically re-added to the posting queue. Published history and posting limits
are kept. Facebook setup supports modern PROFILE_PLUS full-control roles and an optional
`PEAKCUT_FACEBOOK_PAGE_ID` target to exclude unrelated managed Pages.
