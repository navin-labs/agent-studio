# Foley set for authored films: physical sounds only (paper, cloth, wood, metal, glass), from Kenney CC0 packs in ~/Dev/tools/sfx,
# each low-passed where it is bright, levelled, with a 20 ms tail fade. Writes public/sfx/foley/<name>.wav (committed, CC0).
#   ~/Dev/tools/ace-step/.venv/bin/python scripts/foley.py
# No UI blips on purpose (tick, ping, glitch, error, notification): a film adds one only if its story is about an interface.
import glob
import os
import shutil
import subprocess

import numpy as np
import soundfile as sf

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sfx', 'foley')
# name: (Kenney source, lowpass Hz or 0, gain dB)
SET = {
    'page': ('bookFlip2', 7000, -3), 'flip': ('bookFlip3', 5000, -8), 'book': ('bookPlace1', 0, -3), 'cloth': ('cloth1', 0, 0),
    'tear': ('cloth4', 6000, -2), 'swish': ('cloth3', 5000, -6), 'land': ('dropLeather', 5000, 0), 'soft': ('impactSoft_medium_001', 0, 0),
    'sack': ('impactSoft_heavy_001', 0, 0), 'press': ('impactSoft_heavy_002', 0, 0), 'latch': ('metalLatch', 3500, -4),
    'catch': ('metalClick', 3000, -3), 'pop': ('impactPlate_light_000', 4000, -3), 'wood': ('impactWood_light_000', 0, -2),
    'plank': ('impactPlank_medium_000', 0, -3), 'stamp': ('impactWood_heavy_002', 0, 0), 'thump': ('impactPunch_heavy_001', 0, -2),
    'pen': ('scratch_004', 3000, -8), 'chalk': ('scratch_001', 2500, -10), 'switch': ('switch20', 3500, -2), 'glass': ('impactGlass_light_000', 6000, -8),
    'coin': ('handleCoins', 0, -4), 'drop': ('impactGeneric_light_000', 0, -3), 'tin': ('impactTin_medium_000', 4000, -5),
    'metal': ('impactMetal_light_000', 4000, -6), 'bell': ('impactBell_heavy_000', 3000, -12), 'creak': ('creak1', 0, -6),
    'door': ('doorClose_1', 0, -4), 'step': ('footstep_wood_000', 0, -5), 'knife': ('knifeSlice', 6000, -6),
}


def lowpass(x, cut):
    # 2-pole RC cascade, enough to take the edge off bright plastic transients
    a = np.exp(-2 * np.pi * cut / SR)
    for _ in range(2):
        y = np.empty_like(x)
        acc = 0.0
        for i, v in enumerate(x):
            acc = (1 - a) * v + a * acc
            y[i] = acc
        x = y
    return x


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    ffmpeg = shutil.which('ffmpeg') or os.path.join(os.path.dirname(__file__), '..', 'node_modules/@remotion/compositor-darwin-arm64/ffmpeg')
    env = {**os.environ, 'DYLD_LIBRARY_PATH': os.path.dirname(ffmpeg)}
    for name, (src, cut, gain) in SET.items():
        path = glob.glob(os.path.expanduser(f'~/Dev/tools/sfx/*/Audio/{src}.ogg'))[0]
        tmp = os.path.join(OUT, '_tmp.wav')
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-c:a', 'pcm_s16le', tmp], check=True, env=env)
        x, _ = sf.read(tmp)
        if cut:
            x = lowpass(x, cut)
        x = x * 10 ** (gain / 20)
        n = int(SR * 0.02)
        x[-n:] *= np.linspace(1, 0, n)
        sf.write(os.path.join(OUT, name + '.wav'), x, SR, subtype='PCM_16')
        os.remove(tmp)
    with open(os.path.join(OUT, 'LICENSE.txt'), 'w') as f:
        f.write('Source sounds: Kenney (kenney.nl) Impact Sounds, Interface Sounds, RPG Audio, UI Audio. License: CC0 1.0.\n')
    print(f'{len(SET)} sounds -> {os.path.relpath(OUT)}')
