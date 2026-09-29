import { test, expect } from '@playwright/test';

/**
 * Renders the real stem engine offline (OfflineAudioContext) with two mid-song
 * rescues, then checks the output sample-by-sample against the raw stems:
 *  - before a rescue only the starter stem is present,
 *  - a rescued stem is silent until the NEXT BAR LINE of the shared origin,
 *  - it then ramps in linearly over one bar (no click) at the CURRENT song
 *    position (it is not restarted from bar 1),
 *  - earlier stems keep playing phase-aligned.
 */
test('rescued stems join on the bar line, in phase, without clicks', async ({ page }) => {
  await page.goto('/?debug');
  await expect(page.locator('.plate.big')).toBeVisible({ timeout: 30_000 });
  const r = await page.evaluate(async () => {
    const { AudioEngine } = await import('/src/audio/AudioEngine.ts' as string);
    const cfg = await import('/src/config/audioConfig.ts' as string);
    const SR = 48000;
    const DUR = 9;
    const off = new OfflineAudioContext(2, SR * DUR, SR);
    const engine = new AudioEngine({
      createContext: () => off as unknown as AudioContext,
      fetchArrayBuffer: (u: string) => fetch(u).then((res) => res.arrayBuffer()),
      wallClock: () => performance.now() / 1000,
      baseUrl: '/',
      bypassDynamics: true,
    });
    engine.initialize();
    await engine.load();
    engine.startTransport(['lead']);
    const origin: number = engine.origin;
    const at: Record<string, number> = {};
    off.suspend(2.3).then(() => { at.bass = engine.setStemActive('bass', true); off.resume(); });
    off.suspend(5.05).then(() => { at.drums = engine.setStemActive('drums', true); off.resume(); });
    const out = await off.startRendering();
    // decode raw stems for the reference
    const raw: Record<string, Float32Array> = {};
    for (const id of ['lead', 'bass', 'drums']) {
      const buf = await off.decodeAudioData(await (await fetch('/' + cfg.STEM_FILES[id].file)).arrayBuffer());
      raw[id] = buf.getChannelData(0);
    }
    const L = out.getChannelData(0);
    const k = cfg.AUDIO_MIX.masterGain * 0.8; // default music volume 0.8
    const bar = cfg.BAR_DURATION;
    const fade = cfg.AUDIO_MIX.stemFadeIn;
    const env = (t: number, t0: number) => (t < t0 ? 0 : Math.min(1, (t - t0) / fade));
    let maxErr = 0;
    let peak = 0;
    let maxStep = 0;
    const o = Math.round(origin * SR);
    for (let n = o + 10; n < SR * DUR - 1; n++) {
      const t = n / SR;
      const pos = (n - o) % raw.lead.length;
      const expected =
        k * (cfg.STEM_FILES.lead.gain * raw.lead[pos] +
          cfg.STEM_FILES.bass.gain * env(t, at.bass) * raw.bass[pos] +
          cfg.STEM_FILES.drums.gain * env(t, at.drums) * raw.drums[pos]);
      maxErr = Math.max(maxErr, Math.abs(L[n] - expected));
      peak = Math.max(peak, Math.abs(L[n]));
      maxStep = Math.max(maxStep, Math.abs(L[n] - L[n - 1]));
    }
    // what if the stem had (wrongly) restarted from bar 1 at its entrance?
    let restartErr = 0;
    const nb = Math.round(at.bass * SR);
    for (let n = nb + Math.round(fade * SR); n < nb + Math.round(fade * SR) + SR / 2; n++) {
      const pos = (n - o) % raw.lead.length;
      const wrong = k * (cfg.STEM_FILES.lead.gain * raw.lead[pos] + cfg.STEM_FILES.bass.gain * raw.bass[n - nb]);
      restartErr = Math.max(restartErr, Math.abs(L[n] - wrong));
    }
    return {
      origin,
      bassAt: at.bass,
      drumsAt: at.drums,
      bassBars: (at.bass - origin) / bar,
      drumsBars: (at.drums - origin) / bar,
      maxErr,
      peak,
      maxStep,
      restartErr,
    };
  });
  // entrances land exactly on bar lines of the shared origin, after the rescue moment
  expect(Math.abs(r.bassBars - Math.round(r.bassBars))).toBeLessThan(1e-6);
  expect(Math.abs(r.drumsBars - Math.round(r.drumsBars))).toBeLessThan(1e-6);
  expect(r.bassAt).toBeGreaterThan(2.3);
  expect(r.bassAt - 2.3).toBeLessThan(1.875 + 0.05);
  expect(r.drumsAt).toBeGreaterThan(5.05);
  // the rendered mix equals the phase-aligned stems with the scheduled envelopes
  expect(r.peak).toBeGreaterThan(0.05);
  expect(r.maxErr).toBeLessThan(0.01);
  // and is clearly NOT what a restarted stem would sound like
  expect(r.restartErr).toBeGreaterThan(0.05);
});
