# Local text-to-speech with built-in voices (no cloning, no API). One engine per venv: engine/.venv-voice/<engine>/.
# One line:   .venv-voice/kokoro/bin/python scripts/tts_local.py --engine kokoro --voice am_michael --speed 1.15 --text "..." --out a.wav
# A batch:    ... --jobs jobs.json   ([{"text", "out"}], the model loads once; make.mjs voices a whole video this way)
# Every clip is levelled to the same loudness (level()). Prints one JSON line per clip: {"seconds", "render_s", "rtf" (render seconds per audio second), "device"}.
# Engines: kokoro (first choice; native speed), parler (named speakers steered by a text description; pace is described, not
# exact), chatterbox (its one default voice; pace via cfg_weight, lower is slower). Measured on the M5 (docs/TECH.md "Voice").
import argparse, json, os, time

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
import numpy as np
import soundfile as sf
import torch

a = argparse.ArgumentParser()
a.add_argument("--engine", required=True, choices=["kokoro", "parler", "chatterbox"])
a.add_argument("--voice", default="")
a.add_argument("--speed", type=float, default=1.0)
a.add_argument("--text")
a.add_argument("--out")
a.add_argument("--jobs")
a.add_argument("--style", default="clear and warm")  # parler: how the voice sounds, e.g. "deep, low-pitched and authoritative"
a.add_argument("--device", default=None)
x = a.parse_args()
# Kokoro is fastest on the CPU (82M parameters); the larger models use the GPU (MPS)
device = x.device or ("cpu" if x.engine == "kokoro" or not torch.backends.mps.is_available() else "mps")

t0 = time.time()
if x.engine == "kokoro":
    from kokoro import KPipeline
    pipe = KPipeline(lang_code=x.voice[0], repo_id="hexgrad/Kokoro-82M", device=device)  # voice ids start with a (US) or b (UK)
    sr = 24000
    synth = lambda text: np.concatenate([np.asarray(r.audio) for r in pipe(text, voice=x.voice, speed=x.speed)])
elif x.engine == "parler":
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer
    name = "parler-tts/parler-tts-mini-v1"
    model = ParlerTTSForConditionalGeneration.from_pretrained(name).to(device)
    tok = AutoTokenizer.from_pretrained(name)
    sr = model.config.sampling_rate
    pace = "speaks slightly fast" if x.speed > 1.05 else "speaks slowly and calmly" if x.speed < 0.95 else "speaks at a moderate pace"
    desc = tok(f"{x.voice}'s voice is {x.style}, he {pace}, in a close, very clear recording with no background noise.", return_tensors="pt").input_ids.to(device)
    synth = lambda text: model.generate(input_ids=desc, prompt_input_ids=tok(text, return_tensors="pt").input_ids.to(device)).cpu().numpy().squeeze()
else:
    from chatterbox.tts import ChatterboxTTS
    model = ChatterboxTTS.from_pretrained(device=device)
    sr = model.sr
    cfg = 0.3 if x.speed < 0.95 else 0.5  # the default voice only, never a reference clip (no cloning)
    synth = lambda text: model.generate(text, cfg_weight=cfg).squeeze().cpu().numpy()
load = time.time() - t0

# Same loudness for every voice, lead and tail silence trimmed: voiced RMS to -20 dBFS, peak capped at -1 dBFS (af_heart came out 3 dB quieter than am_fenrir).
def level(audio):
    voiced = audio[np.abs(audio) > 0.01]
    if not voiced.size: return audio
    audio = audio * min(0.1 / np.sqrt((voiced ** 2).mean()), 0.891 / np.abs(audio).max())
    # trim the engine's own lead and tail silence to 40 ms: the engine adds the pause between lines (no dead air over 0.5 s)
    loud = np.nonzero(np.abs(audio) > 0.02)[0]
    keep = int(0.04 * sr)
    return audio[max(0, loud[0] - keep): loud[-1] + keep] if loud.size else audio

jobs = json.load(open(x.jobs)) if x.jobs else [{"text": x.text, "out": x.out}]
for j in jobs:
    t1 = time.time()
    audio = level(np.asarray(synth(j["text"]), dtype=np.float32))
    render = time.time() - t1
    sf.write(j["out"], audio, sr)
    secs = len(audio) / sr
    print(json.dumps({"engine": x.engine, "voice": x.voice or "default", "seconds": round(secs, 2), "render_s": round(render, 2), "load_s": round(load, 2), "rtf": round(render / secs, 3), "device": device}), flush=True)
