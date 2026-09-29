#!/usr/bin/env python3
"""Local voice clone with Chatterbox (Resemble AI, MIT licence).
Reads a JSON list of {"text": ..., "out": ...} from argv[1] and writes one WAV per item,
in the voice of the reference recording (argv[2], e.g. voice/navin.wav).
Loads the model once per batch. Uses Apple Silicon GPU (mps) when available."""
import json
import sys

import torch
import torchaudio as ta
from chatterbox.tts import ChatterboxTTS

jobs = json.load(open(sys.argv[1]))
ref = sys.argv[2]
device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
if device == "mps":
    # checkpoints were saved on CUDA; remap tensors when loading on a Mac
    _load = torch.load
    torch.load = lambda *a, **k: _load(*a, **{**k, "map_location": torch.device("mps")})
model = ChatterboxTTS.from_pretrained(device=device)
for job in jobs:
    # exaggeration 0.5 = natural; cfg_weight 0.5 = normal pace (lower is slower, calmer)
    wav = model.generate(job["text"], audio_prompt_path=ref, exaggeration=0.5, cfg_weight=0.5)
    ta.save(job["out"], wav, model.sr)
    print("ok", job["out"], flush=True)
