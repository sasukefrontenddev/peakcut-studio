"""Fresh word timing from the audio actually used in a clip, with an optional local multilingual model."""
import json
import math
import subprocess
import tempfile
import threading
from pathlib import Path
from . import config, media, roman

_slot = threading.Lock()


def available():
    return bool(config.env("PEAKCUT_CAPTION_PYTHON") and config.env("PEAKCUT_CAPTION_MODEL"))


def transcribe_clip(source, start, end, language="auto", romanize=True):
    # Only one multilingual pass at once; the running live recorder keeps its CPU headroom.
    with _slot, tempfile.TemporaryDirectory(prefix="caption-", dir=config.TMP_DIR) as temp:
        wav = Path(temp) / "speech.wav"
        seek = ["-ss", f"{start - 30:.6f}"] if start > 30 else []
        media.run(["ffmpeg", "-y", "-v", "error", "-copyts", "-start_at_zero", *seek, "-i", str(source),
            "-vn", "-af", f"atrim=start={start:.6f}:end={end:.6f},asetpts=PTS-{start:.6f}/TB,aresample=async=1:first_pts=0",
            "-t", f"{end-start:.6f}", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(wav)])
        try:
            result = subprocess.run([config.env("PEAKCUT_CAPTION_PYTHON"), "-m", "studio.whisper_captions",
                config.env("PEAKCUT_CAPTION_MODEL"), str(wav), language], cwd=config.ROOT,
                capture_output=True, text=True, encoding="utf-8", timeout=240, creationflags=media.NO_WINDOW)
            if result.returncode:
                raise RuntimeError("Local multilingual caption model did not finish.")
            data = json.loads(result.stdout)
            words = []
            for w in data["words"]:
                s, e = float(w["s"]), float(w["e"])
                if not math.isfinite(s) or not math.isfinite(e) or e <= s or s >= end-start:
                    continue
                words.append({"w": str(w["w"])[:120], "s": max(0, s), "e": min(end-start, e)})
            return (roman.words(words) if romanize else words), str(data.get("language", "auto"))
        except Exception as e:
            raise RuntimeError("Local multilingual captions failed. Try re-rendering, or turn captions off for this clip.") from e
