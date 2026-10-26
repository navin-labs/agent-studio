// Paid text-to-speech (OpenAI / ElevenLabs) is spend, so it is never chosen by accident:
//   paidProvider  only when TTS_PROVIDER names it explicitly AND its key is present (a key sitting in .env is not consent)
//   CharBudget    a hard per-run ceiling on characters sent (TTS_MAX_CHARS, default 6000, at most 50000), checked BEFORE each request
// Local voices (channel.json "voice") are free and need neither. Self-test: node scripts/tts-budget.mjs test
import assert from 'node:assert';
import path from 'node:path';

export const DEFAULT_CHARS = 6000;
export const ABSOLUTE_CHARS = 50000;
export const paidProvider = (env) => {
  const p = (env.TTS_PROVIDER ?? '').trim().toLowerCase();
  if (p === 'openai' && env.OPENAI_API_KEY) return 'openai';
  if (p === 'elevenlabs' && env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID) return 'elevenlabs';
  return 'none';
};
export const charLimit = (env) => {
  if (env.TTS_MAX_CHARS === undefined || env.TTS_MAX_CHARS === '') return DEFAULT_CHARS;
  const n = Number(env.TTS_MAX_CHARS);
  if (!Number.isInteger(n) || n < 1 || n > ABSOLUTE_CHARS) throw new Error(`TTS_MAX_CHARS must be a whole number from 1 to ${ABSOLUTE_CHARS}, got "${env.TTS_MAX_CHARS}"`);
  return n;
};
export class CharBudget {
  constructor(max) {
    this.max = max;
    this.used = 0;
  }
  spend(n) {
    if (this.used + n > this.max) throw new Error(`paid TTS character budget would be exceeded (${this.used} used + ${n} > ${this.max}); raise TTS_MAX_CHARS deliberately or use the local voice`);
    this.used += n;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename) && process.argv[2] === 'test') {
  assert.equal(paidProvider({}), 'none');
  assert.equal(paidProvider({OPENAI_API_KEY: 'k'}), 'none', 'a key alone is not consent');
  assert.equal(paidProvider({ELEVENLABS_API_KEY: 'k', ELEVENLABS_VOICE_ID: 'v'}), 'none');
  assert.equal(paidProvider({TTS_PROVIDER: 'openai'}), 'none', 'named but no key');
  assert.equal(paidProvider({TTS_PROVIDER: 'OpenAI', OPENAI_API_KEY: 'k'}), 'openai');
  assert.equal(paidProvider({TTS_PROVIDER: 'elevenlabs', ELEVENLABS_API_KEY: 'k'}), 'none', 'no voice id');
  assert.equal(paidProvider({TTS_PROVIDER: 'elevenlabs', ELEVENLABS_API_KEY: 'k', ELEVENLABS_VOICE_ID: 'v'}), 'elevenlabs');
  assert.equal(paidProvider({TTS_PROVIDER: 'something-else', OPENAI_API_KEY: 'k'}), 'none');
  assert.equal(charLimit({}), DEFAULT_CHARS);
  assert.equal(charLimit({TTS_MAX_CHARS: '1200'}), 1200);
  for (const bad of ['abc', '0', '-5', '1.5', 'NaN', 'Infinity', '50001', '1e9']) assert.throws(() => charLimit({TTS_MAX_CHARS: bad}), /TTS_MAX_CHARS must be/, bad);
  const b = new CharBudget(100);
  b.spend(60);
  assert.throws(() => b.spend(41), /would be exceeded \(60 used \+ 41 > 100\)/);
  b.spend(40);
  assert.throws(() => b.spend(1), /would be exceeded/);
  console.log('tts-budget ok: paid TTS needs TTS_PROVIDER named plus its key (a key alone is not consent); the per-run character ceiling is validated, bounded, and checked before each request');
}
