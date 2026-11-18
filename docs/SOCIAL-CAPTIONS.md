# Social post captions

Post copy is separate from spoken subtitles. Publishing builds a creator-first headline from the saved clip title/hook, keeps the clip description, adds a question suited to the clip category, and preserves any custom posting footer. It does not invent events, rewrite speech, or make an extra AI call.

Creator settings include **Creator hashtags**. Up to three configured creator tags take priority. If left empty, PeakCut derives identity tags from the creator’s display name. Clip topic tags fill the remaining space, up to five unique tags total. Duplicate tags and generic spam tags such as fyp/viral are filtered out.

Open **Publish clip → Post caption preview** to inspect the exact text. All upload handlers use this same builder; YouTube also receives its creator-aware title and keyword tags. Existing queued posts use current creator settings when they are sent. Already published posts are not edited by this feature.

### Dialogue-based descriptions

When the optional local multilingual speech model is enabled, final clip audio—not the
English scout transcript—drives social titles and descriptions. The original Hindi/Urdu
script is retained privately for the local Ollama model to understand; subtitles can still
use Roman letters. Turning subtitles off does not disable this speech check.

The writer receives only dialogue, not the previous guessed title, description or tags.
It must return a supporting quotation that occurs in that dialogue. Missing evidence,
unclear speech, or an unavailable local writer produces neutral text instead of preserving
an old invented story. Only configured creator identity hashtags are retained for these
clips. The quotation check reduces unsupported text but cannot guarantee perfect speech
recognition or that every summary claim is correct. Review important clips.

Already published posts are not edited automatically. Old queued clips are checked again
before upload; new clips receive the check while rendering. Speech inference is cached
per clip span and language and may take several minutes on CPU. No paid provider is called
by this metadata pass: it only uses the configured local Ollama provider.
