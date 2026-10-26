# Channel sound identity, synthesised locally (no licence, no download, deterministic: same code, same files).
# run: .venv-voice/kokoro/bin/python scripts/brand_audio.py   -> public/brand/audio/<channel>-{bed,bumper}.wav
#   bed     64 s music bed under the voice (the Composer ducks it with Score and fades it out)
#   bumper  2 s sonic logo that closes every video of the channel
# c1-automation (Chiku, night): bright 8-bit pixel arpeggio over a sub pad, A minor pentatonic, 100 bpm.
# c2-reach (Archive Gold): slow warm pad (Am F C G), soft projector tick, a low bell chime, 72 bpm.
import os
import numpy as np
import soundfile as sf

SR = 24000
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'brand', 'audio')
BED_SECONDS = 64
rng = np.random.default_rng(11)


def t(sec):
    return np.arange(int(sec * SR)) / SR


def hz(note):  # MIDI note -> Hz
    return 440.0 * 2 ** ((note - 69) / 12)


def lowpass(x, cut):
    a = np.exp(-2 * np.pi * cut / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = a * acc + (1 - a) * v
        y[i] = acc
    return y


def place(buf, tone, at):
    i = int(at * SR)
    n = min(len(tone), len(buf) - i)
    if n > 0:
        buf[i:i + n] += tone[:n]


def square(f, sec, duty=0.5, a=0.004, r=0.12):
    x = t(sec)
    w = np.where((x * f) % 1.0 < duty, 1.0, -1.0)
    return w * np.minimum(1, x / a) * np.exp(-x / r)


def sine(f, sec, a=0.01, r=0.5, partials=(1.0,)):
    x = t(sec)
    w = sum(p * np.sin(2 * np.pi * f * (k + 1) * x) for k, p in enumerate(partials))
    return w * np.minimum(1, x / a) * np.exp(-x / r)


def norm(x, peak=0.7):
    return x / max(1e-9, np.max(np.abs(x))) * peak


def c1_bed():
    bpm = 100
    beat = 60 / bpm
    out = np.zeros(int(BED_SECONDS * SR))
    pent = [57, 60, 62, 64, 67, 69]  # A3 C4 D4 E4 G4 A4
    pattern = [0, 2, 3, 2, 4, 3, 2, 1, 0, 2, 3, 5, 4, 3, 2, 3]  # 16 steps = 1 bar of 16ths
    bars = int(BED_SECONDS / (beat * 4))
    for bar in range(bars):
        root = [45, 45, 41, 43][bar % 4]  # A2 A2 F2 G2: the pad under the arpeggio
        place(out, 0.9 * sine(hz(root), beat * 4, a=0.2, r=3.0, partials=(1.0, 0.3)), bar * beat * 4)
        for step, p in enumerate(pattern):
            at = bar * beat * 4 + step * beat / 4
            vel = 0.55 if step % 4 == 0 else 0.3
            place(out, vel * lowpass(square(hz(pent[p] + (0 if bar % 4 < 3 else -2)), 0.2, duty=0.25, r=0.07), 3200), at)
        for q in range(4):  # a soft pixel tick on the beat
            place(out, 0.25 * lowpass(rng.standard_normal(int(0.03 * SR)) * np.exp(-t(0.03) / 0.008), 5000), bar * beat * 4 + q * beat)
    return norm(out)


def c1_bumper():
    out = np.zeros(int(2.0 * SR))
    for k, n in enumerate([69, 72, 76]):  # A4 C5 E5, a rising pixel arpeggio, then the chime
        place(out, 0.7 * lowpass(square(hz(n), 0.25, duty=0.25, r=0.1), 3600), 0.06 + k * 0.11)
    chime = sine(hz(81), 1.5, a=0.004, r=0.55, partials=(1.0, 0.4, 0.15))  # A5
    place(out, 0.9 * chime, 0.42)
    place(out, 0.5 * sine(hz(45), 1.9, a=0.02, r=0.7), 0.0)  # A2 under it
    return norm(out, 0.8)


def c2_bed():
    bpm = 72
    beat = 60 / bpm
    out = np.zeros(int(BED_SECONDS * SR))
    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
    bar = beat * 4
    for b in range(int(BED_SECONDS / bar)):
        for n in chords[b % 4]:
            place(out, 0.5 * sine(hz(n), bar * 1.1, a=0.9, r=2.2, partials=(1.0, 0.25, 0.1)), b * bar)
        place(out, 0.7 * sine(hz(chords[b % 4][0] - 12), bar, a=0.3, r=2.0), b * bar)
        for q in range(4):  # a faint projector tick
            place(out, 0.18 * lowpass(rng.standard_normal(int(0.02 * SR)) * np.exp(-t(0.02) / 0.005), 2500), b * bar + q * beat)
    out += 0.02 * lowpass(rng.standard_normal(len(out)), 900)  # film-room hush
    return norm(out)


def c2_bumper():
    out = np.zeros(int(2.0 * SR))
    for k, p in enumerate((1.0, 2.76, 5.4)):  # a low bell: inharmonic partials
        place(out, [1.0, 0.5, 0.25][k] * sine(hz(57) * p, 1.9, a=0.003, r=[0.9, 0.5, 0.25][k]), 0.05)
    place(out, 0.5 * sine(hz(45), 1.9, a=0.05, r=0.9), 0.0)
    place(out, 0.35 * sine(hz(64), 1.4, a=0.006, r=0.5, partials=(1.0, 0.3)), 0.55)  # E4, a gold note on top
    return norm(out, 0.8)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, wav in {'c1-automation-bed': c1_bed(), 'c1-automation-bumper': c1_bumper(), 'c2-reach-bed': c2_bed(), 'c2-reach-bumper': c2_bumper()}.items():
        sf.write(os.path.join(OUT, f'{name}.wav'), wav, SR, subtype='PCM_16')
        print(f'{name}: {len(wav) / SR:.1f} s, peak {np.max(np.abs(wav)):.2f}')
