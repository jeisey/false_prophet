#!/usr/bin/env node
/**
 * Verify the five soundtrack stems match the FALSE PROPHET audio contract.
 * Run after replacing stems:  npm run audio:verify
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWavHeader } from './wavInfo.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'fp_lead_guitar_loop.wav',
  'fp_rhythm_guitar_loop.wav',
  'fp_bass_loop.wav',
  'fp_drums_loop.wav',
  'fp_vocals_loop.wav',
];
const WANT = { format: 1, channels: 2, sampleRate: 48000, bitsPerSample: 16, frames: 1440000 };
let ok = true;
for (const f of files) {
  const p = resolve(root, 'public/audio/music', f);
  if (!existsSync(p)) {
    console.log(`MISSING  ${f}`);
    ok = false;
    continue;
  }
  let info;
  try {
    info = parseWavHeader(readFileSync(p));
  } catch (e) {
    console.log(`BAD      ${f}: ${e.message}`);
    ok = false;
    continue;
  }
  const problems = [];
  if (info.format !== WANT.format) problems.push(`format ${info.format} (want 1 = PCM)`);
  if (info.channels !== WANT.channels) problems.push(`${info.channels} channels (want 2)`);
  if (info.sampleRate !== WANT.sampleRate) problems.push(`${info.sampleRate} Hz (want 48000)`);
  if (info.bitsPerSample !== WANT.bitsPerSample) problems.push(`${info.bitsPerSample}-bit (want 16)`);
  if (info.frames !== WANT.frames) problems.push(`${info.frames} frames = ${info.duration.toFixed(6)}s (want 1440000 = 30.000000s)`);
  console.log(`${problems.length ? 'BAD ' : 'OK  '}     ${f.padEnd(28)} ${info.channels}ch ${info.bitsPerSample}-bit ${info.sampleRate}Hz ${info.frames} frames ${info.duration.toFixed(6)}s`);
  for (const p2 of problems) console.log(`           - ${p2}`);
  if (problems.length) ok = false;
}
if (!ok) {
  console.log('\nStems do not match the contract. See AUDIO_REPLACEMENT.md.');
  process.exit(1);
}
console.log('\nAll five stems match: 128 BPM / 4/4 / 16 bars = 30.000s, 48 kHz, 16-bit PCM, stereo.');
