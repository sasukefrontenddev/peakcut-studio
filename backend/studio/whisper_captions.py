"""Local multilingual captions. Runs in the optional Whisper Python environment, without cloud APIs."""
import json
import sys
import wave
import numpy as np


def main():
    import onnxruntime
    onnxruntime.disable_telemetry_events()
    from faster_whisper import WhisperModel
    model_path, wav, language = sys.argv[1:4]
    model = WhisperModel(model_path, device="cpu", compute_type="int8", cpu_threads=2, num_workers=1,
                         local_files_only=True)
    with wave.open(wav, "rb") as source:
        if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (1, 2, 16000):
            raise ValueError("Caption audio must be mono 16 kHz PCM.")
        audio = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
    segments, info = model.transcribe(audio, language=None if language == "auto" else language,
        task="transcribe", beam_size=3, temperature=0, max_new_tokens=128, word_timestamps=True,
        vad_filter=True, condition_on_previous_text=False, hallucination_silence_threshold=1.0)
    words = []
    for seg in segments:
        if seg.no_speech_prob > 0.6 or seg.avg_logprob < -0.9 or seg.compression_ratio > 2.4:
            continue
        for word in seg.words or []:
            text = word.word.strip()
            repeated = len(words) >= 2 and all(w["w"].casefold() == text.casefold() for w in words[-2:])
            if text and word.end > word.start and word.probability >= 0.35 and not repeated:
                words.append({"w": text, "s": round(word.start, 3), "e": round(word.end, 3)})
    print(json.dumps({"words": words, "language": info.language}, ensure_ascii=False))


if __name__ == "__main__":
    main()
