# Cut objects out of photos with BiRefNet (rembg session "birefnet-general"; code and weights MIT), trim to the object and
# score how usable the cut-out is. Runs in its own venv outside the repo (docs/FILM_PIPELINE_PLAN.md, E1):
#   ~/Dev/tools/cutout/bin/python scripts/cutout.py jobs.json
# jobs.json: [{"src": "a.jpg", "out": "a.png", "noun": "dog"}, ...]. Prints one JSON line per job: {"out", "w", "h", "score", "match", "why"}.
# Score (0..1): one clear object that is not cut off by the photo's edge and fills a sensible share of it, times how surely it
# IS the noun: CLIP (open_clip ViT-B-32, MIT) compares the cut-out with the noun against people, art, text, screens and plants.
import json, sys
import numpy as np
from PIL import Image
from rembg import new_session, remove

import open_clip, torch

session = new_session("birefnet-general")
clip, _, prep = open_clip.create_model_and_transforms("ViT-B-32", pretrained="laion2b_s34b_b79k")
tok = open_clip.get_tokenizer("ViT-B-32")
OTHERS = ["a person", "a painting or a drawing", "text, a logo or a sign", "a screenshot or a phone screen", "green leaves", "furniture", "an empty background"]

def match(img, noun):  # probability the cut-out shows the noun rather than a usual wrong pick
    labels = [f"a photo of a {noun}"] + [o for o in OTHERS if noun.split()[-1] not in o]
    with torch.no_grad():
        i = clip.encode_image(prep(img).unsqueeze(0))
        t = clip.encode_text(tok(labels))
        i, t = i / i.norm(dim=-1, keepdim=True), t / t.norm(dim=-1, keepdim=True)
        return float((100 * i @ t.T).softmax(dim=-1)[0, 0])
for job in json.load(open(sys.argv[1])):
    try:
        img = Image.open(job["src"]).convert("RGB")
        img.thumbnail((2048, 2048))
        if job.get("photo"):  # a whole photo (a window or plate): only whether it shows the noun matters
            m = match(img, job.get("noun", ""))
            print(json.dumps({"out": job["out"], "w": img.width, "h": img.height, "score": round(m, 3), "match": round(m, 3), "why": [] if m >= 0.5 else [f"may not be a {job.get('noun')} ({m:.0%})"]}), flush=True)
            continue
        cut = remove(img, session=session)  # RGBA
        a = np.asarray(cut)[:, :, 3].astype(np.float32) / 255
        solid = a > 0.5
        area = solid.mean()
        h, w = a.shape
        # how much of the object touches the photo's border (cut off objects look wrong when floated)
        edge = np.concatenate([solid[0], solid[-1], solid[:, 0], solid[:, -1]]).mean()
        # soft, fuzzy masks (half-transparent everywhere) mean the model was unsure
        unsure = ((a > 0.1) & (a < 0.9)).sum() / max(1, (a > 0.1).sum())
        why = []
        s = 1.0
        if area < 0.04: s -= 0.6; why.append(f"tiny object ({area:.0%})")
        elif area > 0.85: s -= 0.6; why.append(f"no background removed ({area:.0%})")
        if edge > 0.02: s -= min(0.6, edge * 4); why.append(f"cut off at the edge ({edge:.0%})")
        if unsure > 0.35: s -= 0.3; why.append(f"soft mask ({unsure:.0%})")
        ys, xs = np.where(a > 0.05)
        if len(xs):
            pad = 12
            box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + pad), min(h, ys.max() + pad))
            cut = cut.crop(box)
        cut.save(job["out"])
        flat = Image.new("RGB", cut.size, (255, 255, 255))
        flat.paste(cut, mask=cut.split()[3])
        m = match(flat, job.get("noun", ""))
        if m < 0.5: why.append(f"may not be a {job.get('noun')} ({m:.0%})")
        print(json.dumps({"out": job["out"], "w": cut.width, "h": cut.height, "score": round(max(0.0, s) * min(1.0, m / 0.5), 3), "match": round(m, 3), "why": why}), flush=True)
    except Exception as e:  # one bad download never stops the batch
        print(json.dumps({"out": job["out"], "score": 0, "why": [f"error: {e}"]}), flush=True)
