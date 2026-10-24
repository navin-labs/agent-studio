# POC sound: music beds and SFX synthesised locally (no licence, no download). Deterministic: same seed, same files.
# run: .venv-voice/kokoro/bin/python scripts/poc_audio.py   -> public/poc/<video>/{music.wav, <sfx>.wav}
# ponytail: numpy synth is a stand-in; if the POC passes, a licensed music library replaces the beds (SFX may stay).
import os
import numpy as np
import soundfile as sf

SR = 48000
rng = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'poc')


def t(sec):
    return np.arange(int(sec * SR)) / SR


def env(n, a=0.005, r=0.3):
    x = np.arange(n) / SR
    return np.minimum(1, x / a) * np.exp(-x / r)


def lowpass(x, cut):
    a = np.exp(-2 * np.pi * cut / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):  # one-pole; fine for seconds of audio
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def pluck(f, dur=1.6, bright=0.5):
    # Karplus-Strong string: warm, organic, not a synth preset
    n = int(dur * SR)
    p = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.994 + 0.005 * bright)
    return out * env(n, 0.002, dur / 3)


def pad(notes, dur, cut=900):
    x = t(dur)
    s = sum(np.sin(2 * np.pi * hz(m) * x) + 0.5 * np.sin(2 * np.pi * hz(m) * 1.003 * x + 1) for m in notes)
    s = lowpass(s / len(notes), cut)
    fade = np.minimum(1, np.minimum(x / 1.5, (dur - x) / 1.5))
    return s * fade


def place(bus, clip, at, gain=1.0):
    i = int(at * SR)
    j = min(len(bus), i + len(clip))
    if i < len(bus):
        bus[i:j] += clip[: j - i] * gain


def norm(x, peak):
    return x / (np.max(np.abs(x)) + 1e-9) * peak


def save(name, x):
    os.makedirs(os.path.dirname(name), exist_ok=True)
    sf.write(name, np.stack([x, x], 1).astype(np.float32), SR)


# ---------- SFX ----------
def noise(sec):
    return rng.uniform(-1, 1, int(sec * SR))


def thud(f=70, r=0.12):
    x = t(0.4)
    return norm(np.sin(2 * np.pi * f * x * (1 - 0.4 * x)) * env(len(x), 0.002, r) + 0.15 * lowpass(noise(0.4), 800) * env(len(x), 0.001, 0.03), 1)


def click():
    x = t(0.12)
    return norm(np.sin(2 * np.pi * 2400 * x) * env(len(x), 0.0005, 0.008) + 0.6 * np.sin(2 * np.pi * 420 * x) * env(len(x), 0.001, 0.03), 1)


def swish(sec=0.45, lo=400, hi=3000):
    n = noise(sec)
    x = t(sec)
    cut = lo + (hi - lo) * np.sin(np.pi * x / sec)
    y = np.empty_like(n)
    acc = 0.0
    for i, v in enumerate(n):
        a = np.exp(-2 * np.pi * cut[i] / SR)
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return norm(y * np.sin(np.pi * x / sec) ** 2, 1)


def rip(sec=0.55):
    x = t(sec)
    grains = (np.sin(2 * np.pi * 70 * x) > 0.2).astype(float)  # the hooks letting go, one by one
    y = lowpass(noise(sec), 5000) - lowpass(noise(sec), 600)
    return norm(y * grains * np.minimum(1, x / 0.02) * np.exp(-x / 0.35), 1)


def iris():
    x = t(0.7)
    f = 300 + 900 * x
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / 0.7) ** 2 * 0.5, 1)


def tick():
    x = t(0.05)
    return norm(lowpass(noise(0.05), 6000) * env(len(x), 0.0005, 0.006), 1)


def chime(notes=(76, 83, 88)):
    x = t(1.8)
    s = sum(np.sin(2 * np.pi * hz(m) * x) * env(len(x), 0.003 + k * 0.04, 0.6) for k, m in enumerate(notes))
    return norm(s, 1)


def beep(f=1000, sec=0.12):
    x = t(sec)
    return norm(np.sign(np.sin(2 * np.pi * f * x)) * 0.3 * env(len(x), 0.002, sec), 1)


def scribble(sec=0.5):
    # polygraph pen on paper
    x = t(sec)
    y = lowpass(noise(sec), 3500) * (0.6 + 0.4 * np.sin(2 * np.pi * 13 * x))
    return norm(y * np.minimum(1, x / 0.03) * np.minimum(1, (sec - x) / 0.05), 1)


def buzz(sec=0.35):
    x = t(sec)
    return norm(np.sign(np.sin(2 * np.pi * 110 * x)) * lowpass(np.ones(len(x)), 50) * env(len(x), 0.002, sec), 1)


def keys(n=4):
    out = np.zeros(int(0.12 * n * SR) + SR // 10)
    for k in range(n):
        place(out, tick() * 0.8, k * 0.11 + rng.uniform(0, 0.02))
    return norm(out, 1)


# ---------- Velcro: warm plucked strings, silence at the catch ----------
def velcro():
    d = os.path.join(OUT, 'velcro')
    dur = 30.3
    bus = np.zeros(int(dur * SR))
    beat = 60 / 92
    prog = [(50, 57, 62, 65), (46, 53, 58, 62), (48, 55, 60, 64), (45, 52, 57, 61)]  # Dm Bb C A: curious, a little mythic
    for bar in range(int(dur / (4 * beat)) + 1):
        start = bar * 4 * beat
        notes = prog[bar % 4]
        place(bus, pad([n + 12 for n in notes[1:]], 4 * beat + 1.5, 700) * 0.22, start)
        arp = [notes[0] + 24, notes[1] + 24, notes[2] + 24, notes[3] + 24, notes[2] + 24, notes[1] + 24, notes[2] + 24, notes[3] + 24]
        dense = start >= 18.2  # press-and-pull lifts the energy
        for k, m in enumerate(arp if dense else arp[::2]):
            place(bus, pluck(hz(m), 1.4, 0.4), start + k * beat * (0.5 if dense else 1), 0.32)
        place(bus, pluck(hz(notes[0] + 12), 2.4, 0.2), start, 0.4)
    # silence: the hooks catch at 15.0 s; the music drops out for it and comes back on "Nature's fastener"
    x = np.arange(len(bus)) / SR
    gate = np.clip(np.minimum(np.abs(x - 14.9) / 0.35, 1), 0, 1)
    gate[(x > 14.6) & (x < 15.6)] = 0
    gate = lowpass(gate, 6)
    bus *= gate
    bus *= np.minimum(1, np.minimum(x / 0.4, (dur - x) / 1.2))
    save(os.path.join(d, 'music.wav'), norm(bus, 0.9))
    for name, clip in {'thud': thud(), 'click': click(), 'swish': swish(), 'rip': rip(), 'iris': iris(), 'tick': tick(), 'chime': chime((74, 81, 86))}.items():
        save(os.path.join(d, f'{name}.wav'), clip)


# ---------- Stock: a pulse that lies, then resolves ----------
def stock():
    d = os.path.join(OUT, 'stock')
    dur = 42.1
    bus = np.zeros(int(dur * SR))
    beat = 60 / 112
    x = np.arange(len(bus)) / SR
    for k in range(int(dur / beat)):
        at = k * beat
        if at < 33.9:
            place(bus, thud(48, 0.18), at, 0.55 if k % 2 == 0 else 0.3)  # heartbeat pulse: the polygraph's patient
            if k % 2 == 1 and at > 3.5:
                place(bus, tick(), at, 0.25)
        else:
            place(bus, pluck(hz([57, 64, 69, 71][k % 4]), 1.2, 0.6), at, 0.3)  # truth: the pulse becomes a melody
    bus += pad([45, 52, 60], dur, 400) * 0.18 * (x < 33.9)  # uneasy minor drone (A, E, C) under the lie
    tail = pad([57, 64, 69, 73], dur - 33.9, 900) * 0.25  # A major when the stock tells the truth
    place(bus, tail, 33.9)
    gate = np.ones(len(bus))
    gate[(x > 24.2) & (x < 24.6)] = 0  # one beat of silence before the automation starts
    bus *= lowpass(gate, 12)
    bus *= np.minimum(1, (dur - x) / 1.2)
    save(os.path.join(d, 'music.wav'), norm(bus, 0.9))
    for name, clip in {'scribble': scribble(), 'thud': thud(60, 0.1), 'stamp': thud(90, 0.06), 'beep': beep(), 'buzz': buzz(), 'keys': keys(), 'chime': chime(), 'tick': tick(), 'swish': swish(0.3, 800, 5000)}.items():
        save(os.path.join(d, f'{name}.wav'), clip)


if __name__ == '__main__':
    assert len(pluck(220, 0.5)) == SR // 2 and np.isfinite(pluck(220, 0.5)).all()  # ponytail: one check that the synth runs clean
    velcro()
    stock()
    print('written', sorted(os.listdir(os.path.join(OUT, 'velcro'))), sorted(os.listdir(os.path.join(OUT, 'stock'))))
