/**
 * HTML overlay for menus and modal moments. Kept to a handful of DOM nodes;
 * gameplay HUD lives in Phaser. Every control is a real <button> with visible
 * focus, large touch targets and keyboard support.
 */
import { App } from '../app';
import { BAND, MEMBER_ORDER, type MemberId } from '../data/band';
import { UPGRADES, type UpgradeId } from '../data/upgrades';
import { STEM_FILES, STEM_IDS, type StemId } from '../config/audioConfig';
import { ART } from '../game/art/atlas';
import { formatClock, type RunState } from '../state/RunState';
import { goToMenu, startRun } from '../flow';
import type { BackdropScene } from '../game/scenes/BackdropScene';

type Cleanup = () => void;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class Overlay {
  private cleanups: Cleanup[] = [];
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  current: string = 'none';

  constructor(private root: HTMLElement) {
    document.addEventListener('keydown', (e) => this.keyHandler?.(e));
  }

  clear(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.keyHandler = null;
    this.root.querySelectorAll(':scope > .screen').forEach((n) => n.remove());
    this.current = 'none';
  }

  private screen(cls: string, html: string): HTMLElement {
    this.clear();
    const el = document.createElement('div');
    el.className = `screen ${cls}`;
    el.innerHTML = html;
    this.root.appendChild(el);
    return el;
  }

  private click(el: Element | null, fn: () => void, sfx: 'uiClick' | 'uiConfirm' | null = 'uiClick'): void {
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (sfx) App.audio.playSfx(sfx, { volume: 0.8 });
      fn();
    });
  }

  private focusFirst(el: HTMLElement | null): void {
    if (!el || document.body.classList.contains('touch')) return;
    el.focus({ preventScroll: true });
  }

  private backdrop(mode: 'title' | 'select' | 'hidden', focus: MemberId | null = null): void {
    const sc = App.game.scene.getScene('backdrop') as BackdropScene | null;
    if (sc && App.game.scene.isActive('backdrop')) sc.setMode(mode, focus);
  }

  /** First meaningful gesture on the title unlocks Web Audio + starts loading stems. */
  private unlockAudio(): void {
    App.audio.initialize();
    void App.audio.load().catch(() => undefined);
  }

  // ------------------------------------------------------------------ title

  showTitle(): void {
    this.backdrop('title');
    const skull = ART.dataUrl('sigil');
    const best = App.store.progress.bestTimeRemaining;
    const wins = Object.values(App.store.progress.victoriesByMember).reduce((a, b) => a + b, 0);
    const el = this.screen(
      'title',
      `
      <button class="plate small corner-btn" data-act="settings" aria-label="Settings">SETTINGS</button>
      <div class="taglines" aria-hidden="true"><div>LOUDER<br>FURTHER<br>STRANGER<br>TOGETHER</div><div>CRASHED<br>STRANDED<br>RECORD<br>SURVIVE</div></div>
      <h1 class="logo"><span class="fp">FALSE PROPHET</span><span class="bd">BREAKDOWN</span></h1>
      <div class="spacer"></div>
      <div class="menu-stack">
        <button class="plate big" data-act="play"><span class="skull l" style="background-image:url(${skull})"></span>PLAY<span class="skull r" style="background-image:url(${skull})"></span></button>
        <button class="plate small" data-act="howto">HOW TO PLAY</button>
        <div class="fine">${best !== null ? `BEST ESCAPE: <b>${formatClock(best)}</b> TO SPARE &middot; ` : ''}${wins ? `VICTORIES: <b>${wins}</b>` : 'THE BAND IS WAITING'}</div>
      </div>`,
    );
    this.current = 'title';
    this.click(el.querySelector('[data-act=play]'), () => {
      this.unlockAudio();
      this.showSelect();
    }, 'uiConfirm');
    this.click(el.querySelector('[data-act=howto]'), () => {
      this.unlockAudio();
      this.showHowTo(() => this.showTitle());
    });
    this.click(el.querySelector('[data-act=settings]'), () => {
      this.unlockAudio();
      this.showSettings(() => this.showTitle(), false);
    });
    this.focusFirst(el.querySelector('[data-act=play]') as HTMLElement);
    this.keyHandler = (e) => {
      if (e.key === 'Enter' && document.activeElement === document.body) {
        this.unlockAudio();
        this.showSelect();
      }
    };
  }

  // ------------------------------------------------------------------ select

  showSelect(): void {
    let sel: MemberId = App.store.progress.lastStarter ?? App.selected ?? 'lead';
    const cards = MEMBER_ORDER.map((id) => {
      const m = BAND[id];
      const wins = App.store.progress.victoriesByMember[id];
      return `<button class="card" role="radio" data-id="${id}" style="--mc:${m.colorCss}" aria-label="${m.name}, ${m.role}">
        <img src="${ART.dataUrl(`portrait_${id}`)}" alt="" draggable="false">
        ${wins ? `<span class="wins" title="Victories">&#9733;${wins}</span>` : ''}
        <span class="name">${m.name}</span><span class="role">${m.role}</span></button>`;
    }).join('');
    const el = this.screen(
      'select shade',
      `
      <button class="plate small corner-btn left" data-act="back" aria-label="Back">BACK</button>
      <h1 class="brush" style="margin-top:calc(var(--u)*56)">WHO WAKES UP FIRST?</h1>
      <div class="fine" style="margin-top:calc(var(--u)*6)">YOU PLAY THEM. THE OTHER FOUR ARE OUT THERE.</div>
      <div class="lineup" role="radiogroup" aria-label="Band members">${cards}</div>
      <div class="stage"><canvas width="300" height="340" aria-hidden="true"></canvas></div>
      <div class="detail" aria-live="polite"><div class="info"></div></div>
      <div class="menu-stack" style="margin-top:calc(var(--u)*14)">
        <button class="plate big" data-act="start" style="font-size:calc(var(--u)*50)">START RUN</button>
      </div>`,
    );
    this.current = 'select';
    const detail = el.querySelector('.detail') as HTMLElement;
    const stage = el.querySelector('.stage') as HTMLElement;
    const info = el.querySelector('.info') as HTMLElement;
    const canvas = el.querySelector('canvas') as HTMLCanvasElement;
    const startBtn = el.querySelector('[data-act=start]') as HTMLElement;

    const render = () => {
      const m = BAND[sel];
      el.style.setProperty('--accent', m.colorCss);
      detail.style.setProperty('--mc', m.colorCss);
      startBtn.style.setProperty('--plate-edge', m.colorCss);
      el.querySelectorAll('.card').forEach((c) => {
        const on = (c as HTMLElement).dataset.id === sel;
        c.classList.toggle('sel', on);
        c.setAttribute('aria-checked', String(on));
      });
      info.innerHTML = `
        <div class="dname">${esc(m.name)}</div>
        <div class="drole">${esc(m.role)}</div>
        <div class="dtag">${esc(m.tagline)}</div>
        <p>${esc(m.identity)}</p>
        <div class="solo-box"><div class="k">SIGNATURE SOLO</div><div class="v">${esc(m.soloName)}</div><div class="d">${esc(m.soloDesc)}</div></div>
        <div class="passive"><b>${esc(m.passiveName)}:</b> ${esc(m.passiveDesc)}</div>`;
      this.backdrop('hidden');
      App.selected = sel;
    };
    const pick = (id: MemberId, scroll = true) => {
      if (id !== sel) App.audio.playSfx('uiClick', { volume: 0.6, rate: 0.9 + MEMBER_ORDER.indexOf(id) * 0.08 });
      sel = id;
      render();
      if (scroll) (el.querySelector(`.card[data-id=${id}]`) as HTMLElement)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    };
    el.querySelectorAll('.card').forEach((c) => {
      c.addEventListener('click', () => pick((c as HTMLElement).dataset.id as MemberId, false));
    });
    // swipe on the stage / detail panel cycles members
    let sx = 0;
    for (const zone of [detail, stage]) {
      zone.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
      zone.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 40) {
          const i = MEMBER_ORDER.indexOf(sel);
          pick(MEMBER_ORDER[(i + (dx < 0 ? 1 : 4)) % 5]);
        }
      });
    }
    const go = () => {
      App.audio.initialize();
      startRun(sel, App.store.progress.introWatched && !App.store.settings.introAlways);
    };
    this.click(startBtn, go, 'uiConfirm');
    this.click(el.querySelector('[data-act=back]'), () => this.showTitle());
    this.keyHandler = (e) => {
      const i = MEMBER_ORDER.indexOf(sel);
      if (e.key === 'ArrowRight' || e.key === 'd') pick(MEMBER_ORDER[(i + 1) % 5]);
      else if (e.key === 'ArrowLeft' || e.key === 'a') pick(MEMBER_ORDER[(i + 4) % 5]);
      else if (e.key === 'Escape') this.showTitle();
      else if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) go();
      else return;
      e.preventDefault();
    };
    render();
    this.focusFirst(el.querySelector(`.card[data-id=${sel}]`) as HTMLElement);
    setTimeout(() => (el.querySelector(`.card[data-id=${sel}]`) as HTMLElement)?.scrollIntoView({ inline: 'center', block: 'nearest' }), 30);

    // animated preview: run for 2 beats, shred for 1, idle for 1
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const beat = Math.max(0, now - t0) / 468.75;
      const b = Math.floor(beat) % 4;
      let frame: string;
      if (b < 2) frame = `run${Math.floor(beat * 4) % 4}`;
      else if (b === 2) frame = beat % 1 < 0.6 ? 'atk' : 'idle1';
      else frame = Math.floor(beat * 2) % 2 ? 'idle1' : 'idle0';
      const src = ART.canvasOf(`m_${sel}_${frame}`);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const m = BAND[sel];
      const g = ctx.createRadialGradient(150, 250, 10, 150, 250, 150);
      g.addColorStop(0, m.colorCss + '66');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 300, 340);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(150, 318, 70, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      const sc = 300 / src.width;
      ctx.drawImage(src, 0, 340 - src.height * sc * 0.97 - 6, src.width * sc, src.height * sc);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    this.cleanups.push(() => cancelAnimationFrame(raf));
  }

  // ------------------------------------------------------------------ how to play

  showHowTo(back: () => void): void {
    const touch = document.body.classList.contains('touch');
    const steps: [string, string, string, string][] = [
      ['ui_joy_base', touch ? 'MOVE' : 'MOVE', touch ? 'Drag anywhere with one thumb. The stick appears right under it and follows you.' : 'WASD or arrow keys. On a phone: drag anywhere with one thumb.', '#b455ff'],
      ['fx_bolt', 'ATTACKS ARE AUTOMATIC', 'Your instrument fires on its own. Where you stand and which way you run decide what it hits.', '#2fe6ff'],
      [`solo_${App.selected}`, 'SOLO', touch ? 'Tap the big button when it glows. Each musician has a different signature move.' : 'Press SPACE when it glows.', '#ff6a1f'],
      ['lm_capsule', 'FIND THE BAND', 'Follow the colored signals. Break each siphon, free your bandmate, and hear their part join the song.', '#9dff2e'],
      ['ui_breakdown', 'BREAKDOWN', touch ? 'All five together unlocks the band super. Fill the meter, then unleash it.' : 'All five together unlocks it. Press SHIFT.', '#ff2a2a'],
      ['boss_head', '18:00 ON THE CLOCK', 'Reunite FALSE PROPHET, destroy the Resonance Harvester and escape before the harvest completes.', '#efe4cc'],
    ];
    const el = this.screen(
      'howto-screen dim',
      `<button class="plate small corner-btn left" data-act="back">BACK</button>
       <h1 class="brush" style="margin-top:calc(var(--u)*56)">HOW TO SURVIVE</h1>
       <div class="howto">${steps
         .map(([k, t, d, c]) => `<div class="step" style="--c:${c}"><img src="${ART.dataUrl(k)}" alt=""><div><div class="t">${t}</div><div class="d">${d}</div></div></div>`)
         .join('')}</div>`,
    );
    this.current = 'howto';
    this.click(el.querySelector('[data-act=back]'), back);
    this.focusFirst(el.querySelector('[data-act=back]') as HTMLElement);
    this.keyHandler = (e) => {
      if (e.key === 'Escape') back();
    };
  }

  // ------------------------------------------------------------------ settings / pause

  private settingsRows(): string {
    const s = App.store.settings;
    const tog = (key: string, label: string, on: boolean) =>
      `<div class="row"><span>${label}</span><button class="toggle" data-toggle="${key}" aria-pressed="${on}">${on ? 'ON' : 'OFF'}</button></div>`;
    return `
      <div class="row"><label for="vol-music">MUSIC</label><input id="vol-music" type="range" min="0" max="100" value="${Math.round(s.musicVolume * 100)}"></div>
      <div class="row"><label for="vol-sfx">SFX</label><input id="vol-sfx" type="range" min="0" max="100" value="${Math.round(s.sfxVolume * 100)}"></div>
      ${tog('muted', 'MUTE ALL', s.muted)}
      ${tog('reducedShake', 'REDUCED SHAKE', s.reducedShake)}
      ${tog('reducedFlash', 'REDUCED FLASHING', s.reducedFlash)}
      ${tog('haptics', 'HAPTICS', s.haptics)}
      ${tog('damageNumbers', 'DAMAGE NUMBERS', s.damageNumbers)}
      ${tog('introAlways', 'ALWAYS PLAY INTRO', s.introAlways)}`;
  }

  private wireSettings(el: HTMLElement): void {
    const music = el.querySelector('#vol-music') as HTMLInputElement;
    const sfx = el.querySelector('#vol-sfx') as HTMLInputElement;
    music.addEventListener('input', () => App.store.updateSettings({ musicVolume: +music.value / 100 }));
    sfx.addEventListener('input', () => App.store.updateSettings({ sfxVolume: +sfx.value / 100 }));
    sfx.addEventListener('change', () => App.audio.playSfx('pickup', { volume: 1 }));
    el.querySelectorAll('[data-toggle]').forEach((b) => {
      b.addEventListener('click', () => {
        const key = (b as HTMLElement).dataset.toggle as keyof typeof App.store.settings;
        const next = !(App.store.settings[key] as boolean);
        App.store.updateSettings({ [key]: next } as any);
        b.setAttribute('aria-pressed', String(next));
        b.textContent = next ? 'ON' : 'OFF';
        App.audio.playSfx('uiClick');
        if (key === 'haptics' && next) App.haptic(30);
      });
    });
  }

  showSettings(back: () => void, inRun: boolean): void {
    const el = this.screen(
      'settings dim',
      `<button class="plate small corner-btn left" data-act="back">BACK</button>
       <h1 class="brush" style="margin:calc(var(--u)*56) 0 calc(var(--u)*14)">SETTINGS</h1>
       <div class="panel">
         ${this.settingsRows()}
         ${inRun ? '' : `<div class="row" style="margin-top:calc(var(--u)*8)"><span>STEM CHECK</span><span class="fine">TOGGLE EACH PART</span></div>
         <div class="stems">${STEM_IDS.map((id) => `<button class="stem-btn" data-stem="${id}" aria-pressed="false" style="--sc:${BAND[id].colorCss}">${STEM_FILES[id].label.replace(' Guitar', '').toUpperCase()}</button>`).join('')}</div>
         <div class="stem-status" aria-live="polite">Stems play in sync; each toggle lands on the next bar line.</div>`}
       </div>`,
    );
    this.current = 'settings';
    this.wireSettings(el);
    if (!inRun) this.wireStemCheck(el);
    const leave = () => {
      if (!inRun && !App.run) App.audio.stopTransport();
      back();
    };
    this.click(el.querySelector('[data-act=back]'), leave);
    this.focusFirst(el.querySelector('[data-act=back]') as HTMLElement);
    this.keyHandler = (e) => {
      if (e.key === 'Escape') leave();
    };
  }

  /** Debug-friendly stem mixer: proves sync + bar-quantized entrances. */
  private wireStemCheck(el: HTMLElement): void {
    const status = el.querySelector('.stem-status') as HTMLElement;
    const on = new Set<StemId>();
    let raf = 0;
    const updateStatus = () => {
      if (App.audio.transportRunning && App.audio.status === 'running') {
        const bar = App.audio.getCurrentBar();
        const beat = App.audio.getCurrentBeat();
        status.textContent = `BAR ${(Math.floor(bar) % 16) + 1}/16 · BEAT ${(Math.floor(beat) % 4) + 1} · ${on.size} STEM${on.size === 1 ? '' : 'S'} LIVE`;
      }
      raf = requestAnimationFrame(updateStatus);
    };
    raf = requestAnimationFrame(updateStatus);
    this.cleanups.push(() => cancelAnimationFrame(raf));
    el.querySelectorAll('[data-stem]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = (b as HTMLElement).dataset.stem as StemId;
        App.audio.initialize();
        try {
          status.textContent = 'Loading stems…';
          await App.audio.load();
        } catch {
          status.textContent = `Audio unavailable: ${App.audio.lastError ?? 'unknown error'}`;
          return;
        }
        if (on.has(id)) on.delete(id);
        else on.add(id);
        if (!App.audio.transportRunning || App.audio.status !== 'running') {
          App.audio.startTransport(on);
        } else {
          App.audio.setStemActive(id, on.has(id));
        }
        b.setAttribute('aria-pressed', String(on.has(id)));
      });
    });
  }

  showPause(onResume: () => void, onQuit: () => void, onRestart: () => void): void {
    const run = App.run;
    const el = this.screen(
      'pause dim',
      `<h1 class="brush" style="margin:calc(var(--u)*60) 0 calc(var(--u)*6)">PAUSED</h1>
       <div class="fine" style="margin-bottom:calc(var(--u)*14)">${run ? `CLOCK FROZEN AT <b>${run.clockText}</b> &middot; BAND ${run.band.length}/5` : ''}</div>
       <div class="panel">${this.settingsRows()}</div>
       <div class="spacer"></div>
       <div class="menu-stack">
         <button class="plate big" data-act="resume" style="font-size:calc(var(--u)*48)">RESUME</button>
         <div class="btn-row">
           <button class="plate small" data-act="restart">RESTART RUN</button>
           <button class="plate small danger" data-act="quit">QUIT TO MENU</button>
         </div>
       </div>`,
    );
    this.current = 'pause';
    this.wireSettings(el);
    this.click(el.querySelector('[data-act=resume]'), onResume, 'uiConfirm');
    this.click(el.querySelector('[data-act=quit]'), onQuit);
    this.click(el.querySelector('[data-act=restart]'), onRestart);
    this.focusFirst(el.querySelector('[data-act=resume]') as HTMLElement);
    this.keyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onResume();
      }
    };
  }

  // ------------------------------------------------------------------ level up

  showLevelUp(choices: UpgradeId[], title: string, onPick: (id: UpgradeId) => void): void {
    const run = App.run!;
    const accent = BAND[run.starter].colorCss;
    const cards = choices
      .map((id, i) => {
        const u = UPGRADES[id];
        const rank = run.rankOf(id);
        const pips = Array.from({ length: u.maxRank }, (_, k) => `<i class="${k < rank ? 'on' : k === rank ? 'next' : ''}"></i>`).join('');
        return `<button class="pedal" data-id="${id}" style="--pc:${u.color === '#101010' || u.color === '#141414' ? '#ff3c3c' : u.color}" aria-label="${u.name}: ${u.ranks[rank]}. Press ${i + 1}">
          <img src="${ART.dataUrl(`pedal_${id}`)}" alt="">
          <span><span class="pk">${u.kind}${rank ? ` · LEVEL ${rank + 1}` : ' · NEW'}</span>
          <div class="pn">${u.name}</div>
          <div class="pb">${esc(u.blurb)}</div>
          <div class="pr">${esc(u.ranks[rank])}</div>
          <div class="pips">${pips}</div></span></button>`;
      })
      .join('');
    const el = this.screen(
      'levelup dim',
      `<div class="hdr">${esc(title)}</div><div class="sub">PICK ONE PIECE OF GEAR</div><div class="pedals">${cards}</div>`,
    );
    el.style.setProperty('--accent', accent);
    this.current = 'levelup';
    let done = false;
    const choose = (id: UpgradeId) => {
      if (done) return;
      done = true;
      App.audio.playSfx('levelUp', { volume: 0.9 });
      App.haptic(20);
      onPick(id);
    };
    el.querySelectorAll('.pedal').forEach((b) => {
      // guard against the thumb that triggered the level-up tapping through instantly
      const armedAt = performance.now() + 280;
      b.addEventListener('click', () => {
        if (performance.now() < armedAt) return;
        choose((b as HTMLElement).dataset.id as UpgradeId);
      });
    });
    this.focusFirst(el.querySelector('.pedal') as HTMLElement);
    if (App.autopilot) setTimeout(() => choose(choices[0]), 350);
    this.keyHandler = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) {
        e.preventDefault();
        choose(choices[n - 1]);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = [...el.querySelectorAll('.pedal')] as HTMLElement[];
        const i = list.indexOf(document.activeElement as HTMLElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
      }
    };
  }

  // ------------------------------------------------------------------ intro skip / tuning / audio chip

  showSkip(onSkip: () => void): void {
    const el = this.screen('intro-skip', `<button class="plate small corner-btn" data-act="skip" aria-label="Skip intro">SKIP &#9656;&#9656;</button>`);
    el.style.pointerEvents = 'none';
    (el.querySelector('button') as HTMLElement).style.pointerEvents = 'auto';
    this.current = 'intro';
    this.click(el.querySelector('[data-act=skip]'), onSkip);
    this.keyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 's') onSkip();
    };
  }

  showTuning(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tuning';
    el.innerHTML = '<span>TUNING UP…</span>';
    this.root.appendChild(el);
    return el;
  }

  showAudioChip(onRetry: () => void): void {
    this.hideAudioChip();
    const b = document.createElement('button');
    b.className = 'audio-chip';
    b.textContent = 'AUDIO OFF — TAP TO RETRY';
    b.addEventListener('click', () => onRetry());
    this.root.appendChild(b);
  }

  hideAudioChip(): void {
    this.root.querySelectorAll('.audio-chip').forEach((n) => n.remove());
  }

  // ------------------------------------------------------------------ results

  showResults(run: RunState, isBest: boolean): void {
    const win = run.phase === 'victory';
    const starter = BAND[run.starter];
    const accent = win ? starter.colorCss : '#b3121d';
    const total = Object.values(run.stats.damageByMember).reduce((a, b) => a + b, 0) || 1;
    const bars = MEMBER_ORDER.filter((m) => run.stats.damageByMember[m] > 0)
      .sort((a, b) => run.stats.damageByMember[b] - run.stats.damageByMember[a])
      .map((m) => {
        const v = run.stats.damageByMember[m];
        return `<div class="dmg-bar" style="--mc:${BAND[m].colorCss}"><span>${BAND[m].name}</span><span class="bar"><i style="width:${Math.max(2, (v / total) * 100)}%"></i></span><span class="n">${Math.round((v / total) * 100)}%</span></div>`;
      })
      .join('');
    const ups = run.stats.upgradesChosen.map((u) => UPGRADES[u].name).join(', ') || '—';
    const reason = win
      ? 'The spectral storm tears open. Five survivors, one song, and a plane-shaped hole in an alien harvest.'
      : run.defeatReason === 'time'
        ? 'The Resonance Harvester completes its extraction. FALSE PROPHET is filed away as a very loud specimen.'
        : 'The band falls silent. The island keeps the recording.';
    const el = this.screen(
      'results dim',
      `<div class="big">${win ? 'FALSE PROPHET<small>REUNITED</small>' : 'HARVEST<small>COMPLETE</small>'}</div>
       ${win && isBest ? '<div class="new-best">NEW BEST ESCAPE</div>' : ''}
       <div class="reason">${reason}</div>
       <dl class="stats">
         ${win ? `<dt>TIME REMAINING</dt><dd>${formatClock(run.timeRemaining)}</dd>` : `<dt>SURVIVED</dt><dd>${formatClock(run.elapsed)}</dd>`}
         <dt>STARTING MEMBER</dt><dd style="color:${starter.colorCss}">${starter.name}</dd>
         <dt>BANDMATES RESCUED</dt><dd>${run.stats.rescueOrder.length} / 4</dd>
         <dt>ENEMIES DESTROYED</dt><dd>${run.stats.kills}</dd>
         <dt>BREAKDOWNS</dt><dd>${run.stats.breakdowns}</dd>
         <dt>GEAR</dt><dd style="font-size:calc(var(--u)*12);max-width:calc(var(--u)*240);text-align:right">${esc(ups)}</dd>
         <div class="dmg-bars">${bars}</div>
       </dl>
       <div class="btn-row" style="margin-top:calc(var(--u)*8)">
         <button class="plate big" data-act="again" style="font-size:calc(var(--u)*40);min-width:calc(var(--u)*260)">${win ? 'PLAY AGAIN' : 'TRY AGAIN'}</button>
       </div>
       <button class="plate small" data-act="menu">MAIN MENU</button>`,
    );
    el.style.setProperty('--accent', accent);
    this.current = 'results';
    const again = () => {
      App.audio.initialize();
      startRun(run.starter, true);
    };
    this.click(el.querySelector('[data-act=again]'), again, 'uiConfirm');
    this.click(el.querySelector('[data-act=menu]'), () => goToMenu());
    this.focusFirst(el.querySelector('[data-act=again]') as HTMLElement);
    this.keyHandler = (e) => {
      if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) again();
      if (e.key === 'Escape') goToMenu();
    };
  }
}
