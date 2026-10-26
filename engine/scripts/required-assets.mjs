// Which render assets are REQUIRED (a missing one is an error) and which are explicitly optional (a warning at most).
//   music        required when the board names one (`music: "x.wav"`): the board asked for it
//   channel mark the channel's own brand/<id>/mark.svg, else the studio mark brand/mark.png: one of them must exist
//   brand audio  brand/audio/<id>-bed.wav + <id>-bumper.wav: both or neither; required for a LIVE channel; optional (warning) for a
//                channel that is not live yet
//   voiceover    required when the channel has a voice configured (checked in make.mjs prepareVoice)
// Self-test: node scripts/required-assets.mjs test
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const musicErrors = (publicDir, music) => (music && !fs.existsSync(path.join(publicDir, 'music', music)) ? [`music file public/music/${music} is named by the board and does not exist`] : []);

export const channelAssets = (publicDir, channel, live) => {
  const has = (...p) => fs.existsSync(path.join(publicDir, ...p));
  const errors = [];
  const warnings = [];
  const own = has('brand', channel, 'mark.svg');
  if (!own && !has('brand', 'mark.png')) errors.push(`no end-card mark: public/brand/${channel}/mark.svg and the studio default public/brand/mark.png are both missing`);
  const [bed, bumper] = [has('brand', 'audio', `${channel}-bed.wav`), has('brand', 'audio', `${channel}-bumper.wav`)];
  if (bed !== bumper) errors.push(`channel ${channel} has only one of its brand audio files (public/brand/audio/${channel}-bed.wav and ${channel}-bumper.wav): add the other or remove both`);
  else if (!bed && live) errors.push(`channel ${channel} is live and has no brand audio (public/brand/audio/${channel}-bed.wav, ${channel}-bumper.wav)`);
  else if (!bed) warnings.push(`channel ${channel} is not live and has no brand audio: rendering without its bed and bumper`);
  return {errors, warnings, mark: own ? `brand/${channel}/mark.svg` : 'brand/mark.png', bumper: bed && bumper};
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename) && process.argv[2] === 'test') {
  const pub = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  const put = (...p) => (fs.mkdirSync(path.dirname(path.join(pub, ...p)), {recursive: true}), fs.writeFileSync(path.join(pub, ...p), 'x'));
  assert.deepEqual(musicErrors(pub, undefined), [], 'no music named: nothing required');
  assert.match(musicErrors(pub, 'calm.wav')[0], /named by the board and does not exist/);
  put('music', 'calm.wav');
  assert.deepEqual(musicErrors(pub, 'calm.wav'), []);
  assert.match(channelAssets(pub, 'c9', true).errors[0], /no end-card mark/, 'neither mark exists');
  put('brand', 'mark.png');
  assert.deepEqual(channelAssets(pub, 'c9', false), {errors: [], warnings: ['channel c9 is not live and has no brand audio: rendering without its bed and bumper'], mark: 'brand/mark.png', bumper: false}, 'explicitly optional: a warning, not silence');
  assert.match(channelAssets(pub, 'c9', true).errors[0], /is live and has no brand audio/, 'a live channel needs it');
  put('brand', 'audio', 'c9-bed.wav');
  assert.match(channelAssets(pub, 'c9', false).errors[0], /only one of its brand audio files/, 'half a pair is always an error');
  put('brand', 'audio', 'c9-bumper.wav');
  put('brand', 'c9', 'mark.svg');
  assert.deepEqual(channelAssets(pub, 'c9', true), {errors: [], warnings: [], mark: 'brand/c9/mark.svg', bumper: true});
  fs.rmSync(pub, {recursive: true});
  console.log('required-assets ok: a named music file, an end-card mark and (for a live channel) both brand audio files are required; a pair with one half is an error; only a not-live channel may go without brand audio, with a warning');
}
