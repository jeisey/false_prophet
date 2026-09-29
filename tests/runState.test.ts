import { describe, expect, it } from 'vitest';
import { RunState, formatClock } from '../src/state/RunState';
import { MEMBER_ORDER } from '../src/data/band';
import { RUN_SECONDS } from '../src/config/gameConfig';

function playing(starter = MEMBER_ORDER[0]) {
  const run = new RunState(starter);
  run.start();
  return run;
}

describe('18-minute countdown', () => {
  it('starts at 18:00 and does not tick during the intro', () => {
    const run = new RunState('lead');
    expect(RUN_SECONDS).toBe(1080);
    expect(run.clockText).toBe('18:00');
    run.tick(5);
    expect(run.timeRemaining).toBe(1080);
    run.start();
    run.tick(1.5);
    expect(run.timeRemaining).toBeCloseTo(1078.5);
    expect(run.clockText).toBe('17:59');
  });

  it('counts down with game time', () => {
    const run = playing();
    for (let i = 0; i < 600; i++) run.tick(1);
    expect(run.clockText).toBe('08:00');
    expect(run.elapsed).toBeCloseTo(600);
  });

  it('triggers game over exactly at zero', () => {
    const run = playing();
    expect(run.tick(1079)).toBe(false);
    expect(run.phase).toBe('playing');
    expect(run.tick(2)).toBe(true);
    expect(run.phase).toBe('defeat');
    expect(run.defeatReason).toBe('time');
    expect(run.timeRemaining).toBe(0);
    expect(run.clockText).toBe('00:00');
    // clock stays frozen after the run ends
    expect(run.tick(5)).toBe(false);
  });

  it('pausing suspends the run timer (any pause reason)', () => {
    const run = playing();
    run.tick(10);
    run.pause('menu');
    run.tick(30);
    expect(run.timeRemaining).toBeCloseTo(1070);
    run.pause('hidden');
    run.resume('menu');
    run.tick(30);
    expect(run.timeRemaining).toBeCloseTo(1070);
    run.resume('hidden');
    run.tick(10);
    expect(run.timeRemaining).toBeCloseTo(1060);
  });

  it('formats clock text', () => {
    expect(formatClock(1080)).toBe('18:00');
    expect(formatClock(59.2)).toBe('01:00');
    expect(formatClock(0.4)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
  });
});

describe('band roster', () => {
  it.each(MEMBER_ORDER)('%s can start; starter recruited, other four missing', (id) => {
    const run = new RunState(id);
    expect(run.starter).toBe(id);
    expect(run.band).toEqual([id]);
    expect(run.isRecruited(id)).toBe(true);
    expect(run.missing).toHaveLength(4);
    expect(run.missing).not.toContain(id);
    expect(run.isFullBand).toBe(false);
  });

  it('rescue adds a member once', () => {
    const run = playing('drums');
    expect(run.rescue('bass')).toBe(true);
    expect(run.band).toEqual(['drums', 'bass']);
    expect(run.companions).toEqual(['bass']);
    expect(run.rescue('bass')).toBe(false);
    expect(run.band).toHaveLength(2);
    expect(run.stats.rescueOrder).toEqual(['bass']);
  });

  it('full band requires all five members', () => {
    const run = playing('vocals');
    for (const m of ['lead', 'rhythm', 'bass'] as const) {
      run.rescue(m);
      expect(run.isFullBand).toBe(false);
    }
    run.rescue('drums');
    expect(run.isFullBand).toBe(true);
  });
});

describe('BREAKDOWN', () => {
  it('is locked before the full band and cannot charge', () => {
    const run = playing('lead');
    run.rescue('rhythm');
    run.rescue('bass');
    run.rescue('drums');
    run.addBreakdown(5);
    expect(run.breakdownMeter).toBe(0);
    expect(run.breakdownUnlocked).toBe(false);
    expect(run.canBreakdown).toBe(false);
    expect(run.useBreakdown()).toBe(false);
  });

  it('unlocks with the fifth member, charges, fires, and resets', () => {
    const run = playing('lead');
    for (const m of ['rhythm', 'bass', 'drums', 'vocals'] as const) run.rescue(m);
    expect(run.breakdownUnlocked).toBe(true);
    expect(run.breakdownMeter).toBeGreaterThan(0);
    expect(run.canBreakdown).toBe(false);
    run.addBreakdown(1);
    expect(run.canBreakdown).toBe(true);
    expect(run.useBreakdown()).toBe(true);
    expect(run.breakdownMeter).toBe(0);
    expect(run.stats.breakdowns).toBe(1);
  });
});

describe('upgrades', () => {
  it('selection changes gameplay modifiers', () => {
    const run = playing();
    expect(run.mods.damageMul).toBe(1);
    run.chooseUpgrade('fuzz');
    expect(run.mods.damageMul).toBeCloseTo(1.2);
    expect(run.mods.sizeMul).toBeGreaterThan(1);
    run.chooseUpgrade('phaser');
    expect(run.mods.pierce).toBe(1);
    run.chooseUpgrade('noisegate');
    expect(run.mods.noiseGate).not.toBeNull();
    run.chooseUpgrade('ebow');
    expect(run.soloCooldownMax).toBeLessThan(13);
    expect(run.stats.upgradesChosen).toEqual(['fuzz', 'phaser', 'noisegate', 'ebow']);
  });

  it('power conditioner raises max HP and heals', () => {
    const run = playing();
    run.damage(60);
    const before = run.hp;
    run.chooseUpgrade('power');
    expect(run.maxHp).toBe(175);
    expect(run.hp).toBeGreaterThan(before);
  });

  it('respects max ranks and companion requirements', () => {
    const run = playing();
    expect(run.availableUpgrades()).not.toContain('stack');
    run.rescue('bass');
    expect(run.availableUpgrades()).toContain('stack');
    for (let i = 0; i < 3; i++) expect(run.chooseUpgrade('fuzz')).toBe(true);
    expect(run.chooseUpgrade('fuzz')).toBe(false);
    expect(run.availableUpgrades()).not.toContain('fuzz');
    const choices = run.rollUpgradeChoices(3, () => 0.5);
    expect(new Set(choices).size).toBe(3);
  });

  it('xp grants pending level-ups consumed by choices', () => {
    const run = playing();
    const ups = run.addXp(60);
    expect(ups).toBe(2);
    expect(run.pendingLevelUps).toBe(2);
    run.chooseUpgrade('wah');
    expect(run.pendingLevelUps).toBe(1);
  });
});

describe('health + ending', () => {
  it('losing all health ends the run', () => {
    const run = playing();
    run.damage(1000);
    expect(run.phase).toBe('defeat');
    expect(run.defeatReason).toBe('health');
  });

  it('boss defeat + extraction produces victory', () => {
    const run = playing();
    expect(run.extract()).toBe(false);
    run.defeatBoss();
    run.tick(100);
    expect(run.extract()).toBe(true);
    expect(run.phase).toBe('victory');
    expect(run.isOver).toBe(true);
    expect(run.timeRemaining).toBeCloseTo(980);
    // timer no longer runs after victory
    run.tick(2000);
    expect(run.phase).toBe('victory');
  });
});
