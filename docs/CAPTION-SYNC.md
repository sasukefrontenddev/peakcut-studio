# Clip sync and captions

The renderer decodes pre-roll and trims audio/video on a shared source timeline before layout and subtitles. This avoids the positive video start offset observed when seeking into copied live MPEG-TS segments. Flash/beep regression fixtures test cuts between keyframes, including a source seek.

Creator settings, new video projects and the clip editor provide a Show spoken captions checkbox. Defaults remain on. Turn captions off to skip caption transcription and burned-in word overlays; hook titles remain separate. Existing clips need a re-render to change captions. Already published social videos are not edited by re-rendering.

Optional local multilingual caption recognition uses Faster Whisper on the clip’s actual trimmed audio. Install `backend/requirements-captions.txt` in a compatible Python environment and download a multilingual model locally. Set `captionPython` and `captionModel` in the ignored `.engine-local.json` for the launcher, or `PEAKCUT_CAPTION_PYTHON` and `PEAKCUT_CAPTION_MODEL` for the backend. Models run on CPU without API keys. No audio leaves the computer. A failed configured caption pass marks the render failed instead of silently substituting unrelated speech.

Caption speech language can be automatic, English, Hindi/Hinglish or Urdu. Hindi and Urdu text is rendered in Roman letters. Multilingual caption recognition is separate from the existing live clip-selection transcript. Recognition is still imperfect with overlapping voices, music, names and code-switching; choose the language explicitly when detection gets it wrong.

Old AI-rewritten caption caches are invalidated. Prompt row labels are stripped and invented numbered words are rejected; genuine spoken numeric conversions remain supported. Re-render existing clips to rebuild cached captions.
