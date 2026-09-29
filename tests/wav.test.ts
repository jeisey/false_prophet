import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STEM_FILES, STEM_IDS, STEM_SAMPLE_RATE, STEM_SAMPLES_PER_CHANNEL } from '../src/config/audioConfig';
import { parseWavHeader } from '../scripts/wavInfo.mjs';

describe('placeholder stems', () => {
  for (const id of STEM_IDS) {
    it(`${STEM_FILES[id].file} is 48kHz 16-bit stereo PCM, exactly 30.000s`, () => {
      const buf = readFileSync(resolve(__dirname, '..', 'public', STEM_FILES[id].file));
      const info = parseWavHeader(buf);
      expect(info.format).toBe(1); // PCM
      expect(info.channels).toBe(2);
      expect(info.sampleRate).toBe(STEM_SAMPLE_RATE);
      expect(info.bitsPerSample).toBe(16);
      expect(info.frames).toBe(STEM_SAMPLES_PER_CHANNEL);
      expect(info.duration).toBe(30);
    });
  }

  it('stems are not silent and downbeat energy starts at sample 0 (drums)', () => {
    const buf = readFileSync(resolve(__dirname, '..', 'public', STEM_FILES.drums.file));
    const info = parseWavHeader(buf);
    let peak = 0;
    for (let i = 0; i < 2000; i++) peak = Math.max(peak, Math.abs(buf.readInt16LE(info.dataOffset + i * 4)));
    expect(peak).toBeGreaterThan(3000);
  });
});
