import { describe, expect, it } from 'vitest';
import { Store, type StorageLike } from '../src/state/Settings';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe('settings + progress persistence', () => {
  it('survives a "refresh" (new Store over the same storage)', () => {
    const storage = new MemoryStorage();
    const a = new Store(storage);
    a.updateSettings({ musicVolume: 0.3, sfxVolume: 0.1, reducedShake: true, reducedFlash: true, haptics: false, muted: true });
    a.recordRunStart('bass');
    expect(a.recordVictory('bass', 95)).toBe(true);
    expect(a.recordVictory('bass', 40)).toBe(false);
    a.markIntroWatched();

    const b = new Store(storage);
    expect(b.settings.musicVolume).toBeCloseTo(0.3);
    expect(b.settings.sfxVolume).toBeCloseTo(0.1);
    expect(b.settings.reducedShake).toBe(true);
    expect(b.settings.reducedFlash).toBe(true);
    expect(b.settings.haptics).toBe(false);
    expect(b.settings.muted).toBe(true);
    expect(b.progress.bestTimeRemaining).toBe(95);
    expect(b.progress.victoriesByMember.bass).toBe(2);
    expect(b.progress.victoriesByMember.lead).toBe(0);
    expect(b.progress.introWatched).toBe(true);
    expect(b.progress.runsStarted).toBe(1);
    expect(b.progress.lastStarter).toBe('bass');
  });

  it('tolerates corrupt or missing storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('fp-breakdown.settings.v1', '{not json');
    const s = new Store(storage);
    expect(s.settings.musicVolume).toBeGreaterThan(0);
    const none = new Store(null);
    none.updateSettings({ musicVolume: 0.5 });
    expect(none.settings.musicVolume).toBe(0.5);
  });

  it('clamps out-of-range volumes', () => {
    const s = new Store(new MemoryStorage());
    s.updateSettings({ musicVolume: 4, sfxVolume: -2 });
    expect(s.settings.musicVolume).toBe(1);
    expect(s.settings.sfxVolume).toBe(0);
  });
});
