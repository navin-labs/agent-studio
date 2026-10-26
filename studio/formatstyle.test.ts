// Self-test for the format styles in engine/styles/: each names a real theme, only faces src/fonts.ts loads, real primitives and
// known camera, overlay and host modes, and its theme reads where the primitives put ink on flow (ui-chat's sent bubble), a
// pair the theme gate does not check. The library is diverse: no two styles share camera, overlay and display face.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {THEMES, type ThemeName} from '../engine/src/themes.ts';
import {CAMERA_MODES, FX_OVERLAYS, HOST_MODES, type FormatStyle} from '../engine/src/composer/style.ts';

const ENGINE = path.join(import.meta.dirname, '../engine');
const fonts = fs.readFileSync(path.join(ENGINE, 'src/fonts.ts'), 'utf8');
const prims = new Set(fs.readdirSync(path.join(ENGINE, 'src/primitives')).map((f) => f.replace(/\.tsx?$/, '')));
const lum = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: string, b: string) => ((x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05))(lum(a), lum(b));

const files = fs.readdirSync(path.join(ENGINE, 'styles')).filter((f) => f.endsWith('.json'));
assert.ok(files.length >= 29, `at least 29 format styles, found ${files.length}`);
const looks = new Set<string>();
for (const f of files) {
  const s: FormatStyle = JSON.parse(fs.readFileSync(path.join(ENGINE, 'styles', f), 'utf8'));
  assert.strictEqual(`${s.id}.json`, f, `${f}: id must match the file name`);
  const th = THEMES[s.theme as ThemeName];
  assert.ok(th, `${s.id}: theme ${s.theme} is not in themes.ts`);
  for (const face of Object.values(s.fonts)) assert.ok(fonts.includes(`family: '${face}'`), `${s.id}: font ${face} is not loaded in src/fonts.ts`);
  for (const p of s.fits) assert.ok(prims.has(p), `${s.id}: primitive ${p} does not exist`);
  assert.ok((CAMERA_MODES as readonly string[]).includes(s.cameraMode), `${s.id}: cameraMode ${s.cameraMode}`);
  assert.ok((FX_OVERLAYS as readonly string[]).includes(s.fxOverlay), `${s.id}: fxOverlay ${s.fxOverlay}`);
  assert.ok((HOST_MODES as readonly string[]).includes(s.hostMode), `${s.id}: hostMode ${s.hostMode}`);
  assert.ok(['steady', 'quick'].includes(s.pace), `${s.id}: pace`);
  const look = [s.cameraMode, s.fxOverlay, s.fonts.display].join('|');
  assert.ok(!looks.has(look), `${s.id}: same camera, overlay and display face as another style`);
  looks.add(look);
  assert.ok(['none', 'uppercase', 'lowercase'].includes(s.caption.case), `${s.id}: caption case`);
  assert.ok(s.spring.damping > 0 && s.spring.stiffness > 0 && s.spring.mass > 0, `${s.id}: spring`);
  const r = ratio(th.ink, th.flow);
  assert.ok(r >= 3, `${s.id}: ink on flow (chat bubble text) is ${r.toFixed(2)}, needs 3.0 for large text`);
}
const modes = (k: 'cameraMode' | 'fxOverlay') => new Set(files.map((f) => JSON.parse(fs.readFileSync(path.join(ENGINE, 'styles', f), 'utf8'))[k])).size;
assert.strictEqual(modes('cameraMode'), CAMERA_MODES.length - 1, 'every camera mode but still is used by some style');
assert.strictEqual(modes('fxOverlay'), FX_OVERLAYS.length, 'every overlay (and none) is used by some style');
console.log(`format styles ok: ${files.length} styles over ${CAMERA_MODES.length - 1} camera moves and ${FX_OVERLAYS.length - 1} overlays; every theme, face, primitive and bubble contrast checked`);
