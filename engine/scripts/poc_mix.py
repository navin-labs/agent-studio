# POC audio: arrange two music cues around a video's story, duck them under the real voice, measure, and master.
#   python scripts/poc_mix.py bed <video> <style>        -> public/poc/<video>/<style>/music.wav + mix metrics
#   python scripts/poc_mix.py master <in.mp4> <out.mp4>   -> loudness -14 LUFS, true peak <= -1 dBTP, video stream copied
#   python scripts/poc_mix.py analyse <wav...>            -> BPM, key, loudness, brightness, self-similarity
#   python scripts/poc_mix.py sfx                         -> public/poc/sfx/*.wav from Kenney CC0 foley (~/Dev/tools/sfx)
# Cues come from ACE-Step 1.5 (MIT, commercial use of output allowed): public/poc/music/<video>-<style>-{a,b}.wav.
# Numbers here describe the mix; they do not prove it sounds good. Listening decides.
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

SR = 48000
ENGINE = os.path.join(os.path.dirname(__file__), '..')
PUB = os.path.join(ENGINE, 'public')
LEAD = 4 / 30

# Story per video: scene starts (live render), voice dir, the seam where cue A stops and cue B enters (the reveal),
# moments that rise (no voice, something to see) and moments of silence.
STORY = {
    'velcro': dict(
        dur=30.23, starts=[0, 7.27, 13.13, 18.2, 24.67, 28.23], vo='vo/c2-2026-w41-1/instagram',
        seam=(14.7, 15.55),  # music out before the hooks catch, back in after the click
        shape=[(0, -9), (2.8, -4), (7.3, -3), (10.4, -5), (13.1, -6), (15.6, -3), (18.2, -2), (24.7, 0), (28.3, 0), (30.2, -40)],
        muffle=[(0.0, 2.6, 0.8), (10.5, 14.7, 0.7)],  # hook enters filtered; under the lens the world goes muffled
        hush=[(23.32, 23.5)],  # one beat of space for PRESS
    ),
    'stock': dict(
        dur=42.0, starts=[0, 3.5, 9.57, 16.97, 24.53, 29.17, 33.93, 39.5], vo='vo/c1-2026-w41-1/instagram',
        seam=(33.6, 33.95),  # the lie ends; the truth enters on the chime
        shape=[(0, -6), (3.5, -4), (15.8, -2), (24.2, -40), (24.55, -3), (29.2, -3), (33.95, -2), (39.5, 0), (42, -40)],
        muffle=[(0.0, 1.5, 0.6)],
        hush=[(24.2, 24.55), (12.45, 12.6), (14.35, 14.5)],  # silence before automation; air for the two stamps
    ),
}
DUCK_DB = 10  # music dips this much while the voice speaks
UNDER_DB = 7  # music this far under the voice before ducking: ~17 dB under while talking, ~13 dB in gaps


def load(path):
    x, sr = sf.read(path, always_2d=True)
    x = x.mean(1)
    if sr != SR:
        x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
    return x


def db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)


def lowpass(x, cut=700):
    # FFT brickwall with a soft knee: enough for a "behind glass" muffle, measurement-grade not needed
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cut) ** 4)
    return np.fft.irfft(X, len(x))


def control(n, pts):
    # breakpoints (t, dB) -> per-sample gain
    t = np.arange(n) / SR
    return 10 ** (np.interp(t, [p[0] for p in pts], [p[1] for p in pts]) / 20)


def window(n, spans, fade=0.08):
    # 1 outside spans, 0 inside, with short fades
    t = np.arange(n) / SR
    g = np.ones(n)
    for a, b in spans:
        g = np.minimum(g, np.clip(np.maximum((a - t) / fade, (t - b) / fade), 0, 1))
    return g


def voice_track(st):
    v = np.zeros(int(st['dur'] * SR) + SR)
    for i, s in enumerate(st['starts']):
        p = os.path.join(PUB, st['vo'], f's0{i + 1}.wav')
        if os.path.exists(p):
            c = load(p)
            a = int((s + LEAD) * SR)
            v[a:a + len(c)] += c[: len(v) - a]
    return v


def sidechain(v):
    # voice envelope at 1 kHz control rate, attack 40 ms, release 350 ms -> duck gain per sample
    hop = SR // 1000
    env = np.sqrt(np.convolve(np.square(v), np.ones(hop * 30) / (hop * 30), 'same'))[::hop]
    active = (20 * np.log10(env + 1e-9) > -38).astype(float)
    g = np.empty_like(active)
    y = 0.0
    for i, a in enumerate(active):
        k = 1 - np.exp(-1 / (40 if a > y else 350))
        y += (a - y) * k
        g[i] = y
    g = np.interp(np.arange(len(v)) / hop, np.arange(len(g)), g)
    return 10 ** (-DUCK_DB * g / 20), active


def bed(video, style):
    st = STORY[video]
    n = int(st['dur'] * SR)
    a = load(os.path.join(PUB, 'poc', 'music', f'{video}-{style}-a.wav'))
    b = load(os.path.join(PUB, 'poc', 'music', f'{video}-{style}-b.wav'))
    a, b = (c * 10 ** ((-20 - lufs(c)[0]) / 20) for c in (a, b))  # both cues at the same loudness before the story shapes them
    s0, s1 = st['seam']
    m = np.zeros(n)
    ca = a[: int(s0 * SR) + SR // 4]
    ca[-SR // 4:] *= np.linspace(1, 0, SR // 4)  # cue A breathes out into the seam
    m[: len(ca)] += ca[:n]
    start = int(s1 * SR)
    cb = b[: n - start].copy()
    cb[: SR // 50] *= np.linspace(0, 1, SR // 50)  # cue B enters on the beat, not faded in
    m[start:start + len(cb)] += cb
    # story automation: shape, muffles, hushes, end fade
    lp = lowpass(m)
    amt = np.zeros(n)
    t = np.arange(n) / SR
    for x0, x1, k in st['muffle']:
        amt = np.maximum(amt, k * np.clip(np.minimum((t - x0 + 0.3) / 0.3, (x1 - t) / 0.6), 0, 1))
    m = m * (1 - amt) + lp * amt
    m *= control(n, st['shape']) * window(n, st['hush'])
    v = voice_track(st)[:n]
    duck, active = sidechain(v)
    level = db(v[np.abs(v) > 1e-4]) - UNDER_DB - db(m[m != 0])
    m *= 10 ** (level / 20) * duck
    out = os.path.join(PUB, 'poc', video, style)
    os.makedirs(out, exist_ok=True)
    peak = np.max(np.abs(m))
    if peak > 0.5:
        m *= 0.5 / peak
    sf.write(os.path.join(out, 'music.wav'), np.stack([m, m], 1).astype(np.float32), SR)
    talk = np.interp(np.arange(n) / (SR // 1000), np.arange(len(active)), active) > 0.5
    print(f'{video}/{style}: music under voice while talking {db(v[talk]) - db(m[talk]):.1f} dB, in gaps music is {db(m[~talk & (m != 0)]) - db(v[talk]):.1f} dB vs voice; '
          f'1-4 kHz masking {band(v[talk]) - band(m[talk]):.1f} dB')


def band(x, lo=1000, hi=4000):
    X = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return 10 * np.log10(X[(f >= lo) & (f < hi)].sum() / len(x) + 1e-12)


KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])  # Krumhansl-Kessler
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def analyse(path):
    x = load(path)
    n, hop = 4096, 480  # 100 frames/s
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(frames, axis=1))
    f = np.fft.rfftfreq(n, 1 / SR)
    flux = np.maximum(0, np.diff(np.log1p(S), axis=0)).sum(1)
    flux -= flux.mean()
    ac = np.correlate(flux, flux, 'full')[len(flux) - 1:]
    lags = np.arange(len(ac))
    ok = (lags >= 100 * 60 / 180) & (lags <= 100 * 60 / 60)
    bpm = 6000 / lags[ok][np.argmax(ac[ok])]
    band = (f > 60) & (f < 2000)
    pc = np.zeros(12)
    np.add.at(pc, (np.round(12 * np.log2(f[band] / 440)) + 9).astype(int) % 12, S[:, band].sum(0))
    scores = [(np.corrcoef(np.roll(prof, k), pc)[0, 1], f'{KEYS[k]} {name}') for prof, name in ((MAJ, 'major'), (MIN, 'minor')) for k in range(12)]
    centroid = (S * f).sum(1) / (S.sum(1) + 1e-9)
    chroma = S[:, band] / (S[:, band].sum(1, keepdims=True) + 1e-9)
    sec = chroma[::100]  # one frame a second
    sim = sec @ sec.T / (np.linalg.norm(sec, axis=1)[:, None] * np.linalg.norm(sec, axis=1)[None] + 1e-9)
    rep = sim[np.triu_indices(len(sec), 2)].mean()  # how alike its seconds are: loops score high
    l, lra = lufs(x)
    print(f'{os.path.basename(path)}: {len(x) / SR:.1f}s, ~{bpm:.0f} BPM, key ~{max(scores)[1]}, {l:.1f} LUFS, LRA {lra:.1f}, brightness {np.median(centroid):.0f} Hz, self-similarity {rep:.2f}')


# ---------- loudness (ITU-R BS.1770-4) and master ----------
def kweight(x):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    z = np.exp(-2j * np.pi * f / SR)
    shelf = (1.53512485958697 - 2.69169618940638 * z + 1.19839281085285 * z ** 2) / (1 - 1.69065929318241 * z + 0.73248077421585 * z ** 2)
    hp = (1 - 2 * z + z ** 2) / (1 - 1.99004745483398 * z + 0.99007225036621 * z ** 2)
    return np.fft.irfft(np.fft.rfft(x) * shelf * hp, len(x))


def lufs(x):
    y = kweight(x)
    w, h = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.mean(y[i:i + w] ** 2) for i in range(0, len(y) - w, h)])
    l = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[l > -70]
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g = ms[(l > -70) & (l > rel)]
    st = l[l > -70]
    return -0.691 + 10 * np.log10(g.mean()), np.percentile(st, 95) - np.percentile(st, 10)


def true_peak(x):
    X = np.fft.rfft(x)
    up = np.fft.irfft(np.concatenate([X, np.zeros(len(X) * 3)]), len(x) * 4) * 4
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)


def ffmpeg(*a):
    subprocess.run(['npx', 'remotion', 'ffmpeg', '-v', 'error', '-y', *a], cwd=ENGINE, check=True)


def limit(x, ceiling):
    # look-ahead peak limiter at 1 ms blocks: instant attack (look-ahead covers it), ~50 ms release
    hop = SR // 1000
    lim = 10 ** (ceiling / 20) / 1.12  # margin for inter-sample peaks
    pk = np.abs(x).max(1)
    blocks = np.array([pk[i:i + hop].max() for i in range(0, len(pk), hop)])
    need = np.minimum(1, lim / (blocks + 1e-12))
    need = np.array([need[max(0, i - 5):i + 6].min() for i in range(len(need))])
    g = np.empty_like(need)
    y = 1.0
    for i, v in enumerate(need):
        y = v if v < y else y + (v - y) * 0.02
        g[i] = y
    return x * np.interp(np.arange(len(x)) / hop, np.arange(len(g)), g)[:, None]


def master(src, dst, target=-14.0, ceiling=-2.0):
    tmp = dst + '.wav'
    ffmpeg('-i', src, '-vn', '-ac', '2', '-ar', str(SR), '-c:a', 'pcm_s16le', tmp)
    x, _ = sf.read(tmp, always_2d=True)
    before, _ = lufs(x.mean(1))
    gain = target - before
    for _ in range(4):  # the limiter eats loudness; push the gain until the limited mix lands on target
        y = limit(x * 10 ** (gain / 20), ceiling)
        got, _ = lufs(y.mean(1))
        if abs(got - target) < 0.3:
            break
        gain += target - got
    for _ in range(3):  # AAC adds inter-sample overs: re-check after encoding, tighten the ceiling if needed
        sf.write(tmp, y, SR, subtype='PCM_24')
        ffmpeg('-i', src, '-i', tmp, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', dst)
        tp = encoded_peak(dst)
        if tp <= -1.0:
            break
        ceiling -= tp + 1.2
        y = limit(x * 10 ** (gain / 20), ceiling)
    os.remove(tmp)
    report(dst, f'(was {before:.1f} LUFS, gain {gain:+.1f} dB)')


def encoded_peak(path):
    tmp = path + '.p.wav'
    ffmpeg('-i', path, '-vn', '-ac', '2', '-ar', str(SR), '-c:a', 'pcm_s16le', tmp)
    x, _ = sf.read(tmp, always_2d=True)
    os.remove(tmp)
    return max(true_peak(x[:, 0]), true_peak(x[:, 1]))


def report(path, note=''):
    tmp = path + '.m.wav'
    ffmpeg('-i', path, '-vn', '-ac', '2', '-ar', str(SR), '-c:a', 'pcm_s16le', tmp)
    x, _ = sf.read(tmp, always_2d=True)
    os.remove(tmp)
    l, lra = lufs(x.mean(1))
    tp = max(true_peak(x[:, 0]), true_peak(x[:, 1]))
    print(f'{os.path.basename(path)}: {l:.1f} LUFS, true peak {tp:.1f} dBTP, loudness range {lra:.1f} LU {note}')


# Foley: name -> (Kenney file, lowpass Hz, gain dB). Physical sources only (paper, cloth, wood, metal, leather);
# no UI blips, beeps or notification tones. The lowpass takes the digital edge off the bright ones (latch, click, pen).
SFX = {
    'page': ('bookFlip2', 7000, -3), 'flip': ('bookFlip3', 5000, -8), 'cloth': ('cloth1', 0, 0),
    'land': ('dropLeather', 5000, 0), 'soft': ('impactSoft_medium_001', 0, 0), 'sack': ('impactSoft_heavy_001', 0, 0),
    'press': ('impactSoft_heavy_002', 0, 0), 'latch': ('metalLatch', 3500, -4), 'catch': ('metalClick', 3000, -3),
    'pop': ('impactPlate_light_000', 4000, -3), 'wood': ('impactWood_light_000', 0, -2), 'stamp': ('impactWood_heavy_002', 0, 0),
    'thump': ('impactPunch_heavy_001', 0, -2), 'pen': ('scratch_004', 3000, -8), 'switch': ('switch20', 3500, -2),
    'rip': ('../velcro/rip', 4500, -2),  # velcro tear: the synth noise crackle from poc_audio.py, softened
}


def sfx():
    import glob
    out = os.path.join(PUB, 'poc', 'sfx')
    for name, (src, cut, gain) in SFX.items():
        path = os.path.join(PUB, 'poc', 'sfx', src + '.wav') if src.startswith('..') else glob.glob(os.path.expanduser(f'~/Dev/tools/sfx/*/Audio/{src}.ogg'))[0]
        tmp = os.path.join(out, '_tmp.wav')
        ffmpeg('-i', path, '-ac', '1', '-ar', str(SR), '-c:a', 'pcm_s16le', tmp)
        x = load(tmp)
        if cut:
            x = lowpass(x, cut)
        x = x * 10 ** (gain / 20)
        x[-int(SR * 0.02):] *= np.linspace(1, 0, int(SR * 0.02))  # no click at the tail
        sf.write(os.path.join(out, name + '.wav'), x, SR, subtype='PCM_16')
        os.remove(tmp)
        print(f'{name:7s} <- {src} lowpass {cut or "-"} gain {gain:+d} dB')


if __name__ == '__main__':
    # one check that loudness math is sane: a 1 kHz sine at -20 dBFS peak reads close to -23 LUFS (BS.1770 reference: ~ -3.01 dB)
    s = 0.1 * np.sin(2 * np.pi * 1000 * np.arange(SR * 3) / SR)
    assert abs(lufs(s)[0] - (-23.0)) < 0.6, lufs(s)
    cmd = sys.argv[1]
    if cmd == 'bed':
        bed(sys.argv[2], sys.argv[3])
    elif cmd == 'master':
        master(sys.argv[2], sys.argv[3])
    elif cmd == 'sfx':
        sfx()
    elif cmd == 'analyse':
        for p in sys.argv[2:]:
            analyse(p)
    elif cmd == 'report':
        for p in sys.argv[2:]:
            report(p)
