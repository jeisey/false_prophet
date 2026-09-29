# FALSE PROPHET: BREAKDOWN

A mobile-first, portrait, heavy-metal action-survival game for the browser.

The five-piece metal band **FALSE PROPHET** is dragged out of the sky by an alien
Resonance Snare and scattered across a harvesting island. You play one member.
Survive, find the other four, reassemble the band, destroy the Resonance
Harvester and escape — all before the **18:00** clock runs out.

The band is the progression system. Every rescued member:

1. physically joins the fight as an AI companion,
2. adds their instrument's attack to the party, and
3. **adds their stem to the actual soundtrack** — on the next bar line, in sync.

You start with one instrument playing alone. By the finale all five members are
charging an alien conductor while the complete song finally plays.

## Run it

Requirements: Node.js 18+ (20/22 recommended) and npm. Python 3 is only needed
to regenerate the placeholder music.

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from a phone on your LAN)
```

Production build:

```bash
npm run build      # typecheck + Vite build into dist/
npm run preview    # serve dist/ at http://localhost:4173
```

`dist/` is a static site (relative asset paths) and can be hosted anywhere —
no backend, no accounts, no API keys.

### Tests

```bash
npm test               # unit tests (Vitest): clock, roster, BREAKDOWN, upgrades,
                       # persistence, transport math, stem scheduling, WAV files
npm run typecheck      # TypeScript
npm run test:e2e       # browser tests (Playwright, phone viewport); starts a dev server.
                       # Includes an offline render of the real stem engine that checks
                       # rescued stems enter on the bar line, in phase, click-free.
npm run audio:verify   # checks the five stems match the audio contract
npm run audio:generate # regenerates the placeholder stems (python3, stdlib only)
```

The e2e tests expect Playwright's Chromium to be installed
(`npx playwright install chromium` if you don't have it).

## How to play

| Action     | Phone                                      | Desktop            |
| ---------- | ------------------------------------------ | ------------------ |
| Move       | drag anywhere (floating stick under thumb) | WASD / arrow keys  |
| Attack     | automatic                                  | automatic          |
| SOLO       | big button, bottom right                   | Space              |
| BREAKDOWN  | flaming button (full band only)            | Shift              |
| Pause      | ⏸ top left (or leave the app)              | Esc / P            |
| Mute       | 🔊 top left                                 | M                  |

Loop: follow a colored signal → defeat the siphon guardian → break the siphon
core → defend the capsule while it releases → your bandmate joins (and their
part joins the song) → repeat → with all five, the Resonance Spire opens → beat
**THE NULL MAESTRO** → run for the portal.

Pick up **resonance shards** (XP) for pedal-and-gear upgrades, **stage water**
(heal), **amp charges** (BREAKDOWN / SOLO) and **spare strings/sticks/cable**
(temporary boost). Walk into **road cases** to crack them open.

## The band

Names, colors and lines are data in `src/data/band.ts`; attack numbers are in
`src/data/attacks.ts`.

| Member | Role          | Basic attack                                                                 | SOLO           | Passive |
| ------ | ------------- | ---------------------------------------------------------------------------- | -------------- | ------- |
| VEX    | Lead guitar   | fast riff bolts aimed ahead, chaining lightning between enemies               | **SHREDSTORM** — plant and spin a solo beam + note storm | Momentum: keep moving for up to +30% damage |
| ASH    | Rhythm guitar | slow palm-muted chord blasts in a wide cone with heavy knockback             | **WALL OF SOUND** — expanding armored barrier that shoves everything back and blocks shots | Palm mute: damage resistance after heavy hits |
| GRAVE  | Bass          | sub-bass orbs that detonate on the densest pack and drag enemies inward       | **DROP ZONE** — gravity well that detonates *on the beat* | Low end: enemies near Grave are slowed |
| RIOT   | Drums         | alternating kick (ring around Riot) / snare (on a target) on the beat, cymbal ricochets | **DOUBLE KICK** — one bar of 16th-note blast beats | Blast beat: quick kills raise tempo + damage |
| NYX    | Vocals        | piercing scream arcs that sweep through whole lines                           | **DEATH GROWL** — huge cone that interrupts and marks survivors (+35% damage taken) | Shatter: wounded elites get staggered |

Companions fire streamlined versions of their kit on the 8th-note grid and trade
their signature moves every few bars. With all five, **BREAKDOWN** charges from
kills, elite damage, close calls (grazes) and sustained combat: the camera pulls
back, the band forms up, the mix surges on the downbeat and every instrument
fires its combined signature in sequence.

## Audio architecture

All music timing derives from **one master transport** (`src/audio/AudioEngine.ts`,
math in `src/audio/transportMath.ts`, constants in `src/config/audioConfig.ts`):

- 128 BPM, 4/4, E minor, 16-bar loop → beat 0.46875 s, bar 1.875 s, loop 30.000 s.
- On START RUN (a user gesture) the single `AudioContext` is created/resumed and
  the five stems are fetched + decoded. When gameplay begins, **all five
  `AudioBufferSourceNode`s start at the same `AudioContext` time** with
  `loopStart = 0`, `loopEnd = 30`. Non-recruited members' `GainNode`s sit at 0.
- Rescuing a member calls `setStemActive(member)`: the gain is held at its
  current value until the **next bar line of the shared origin**, then ramps up
  over one bar. Sources are never restarted, so stems can't drift.
- Graph: stem gains → music bus → BREAKDOWN surge gain → pause low-pass → fade →
  compressor → limiter → master → destination; SFX (synthesized at load, in
  E minor) have their own bus. Music, SFX and mute are independent.
- The final boss *suppresses* two stems (they drop out of the mix) until you
  break their siphon anchors; they come back on the next bar.
- Beat-driven gameplay (weapon quantization, metronome enemies, boss patterns,
  pulses) reads the transport through `BeatClock`, which falls back to a
  virtual clock if audio is unavailable — the game never depends on sound working.
- Page hidden → run paused, countdown paused, `AudioContext` suspended.
- If audio fails to start, a compact "AUDIO OFF — TAP TO RETRY" chip appears.

### Placeholder stems

The WAVs in `public/audio/music/` are generated by
`scripts/generate-placeholder-audio.py` (pure Python, no downloads). To drop in
the real band recording, see **[AUDIO_REPLACEMENT.md](./AUDIO_REPLACEMENT.md)**.
SETTINGS → STEM CHECK lets you toggle stems individually to hear the sync.

## Project layout

```
src/
  config/        audioConfig.ts (all musical constants), gameConfig.ts (balance/pacing)
  data/          band, attacks, enemies, upgrades, island layout, lore
  audio/         AudioEngine (transport + mixer), transportMath, sfxBank
  state/         RunState (pure run logic), Settings (localStorage)
  game/
    art/         procedural canvas painters → packed texture atlases
    scenes/      Boot, Backdrop (menus), Intro, Game, Hud
    world/       Terrain (collision grid + painted map), WorldBuilder (decor)
    entities/    Band (leader + companions)
    enemies/     Enemy, EnemySystem (pool + AI)
    bosses/      Minibosses (4 guardians + siphon core), NullMaestro
    combat/      Weapons (kits, SOLOs, BREAKDOWN), Combat (damage), Projectiles
    systems/     BeatClock, Director (spawns), Objectives, Pickups, Fx, Telegraphs
  ui/Overlay.ts  HTML menus (title, select, settings, pause, level-up, results)
scripts/         placeholder audio generator + WAV verifier
tests/           Vitest unit tests
e2e/             Playwright browser tests
```

All art is drawn procedurally at boot (Canvas 2D → texture atlases); there are
no external images or hotlinked assets. Fonts (Metal Mania, Permanent Marker,
Oswald — all OFL) are bundled via `@fontsource`.

## Settings & persistence

Stored in `localStorage` only: music/SFX volume, mute, reduced screen shake,
reduced flashing, haptics, damage numbers, best escape time, victories per
starting member, and whether the intro has been watched (the story intro plays
on your first run; after that START RUN goes straight in unless SETTINGS →
ALWAYS PLAY INTRO is on). Runs themselves are not saved — a run is one focused
18-minute session.

## Performance

Rendering runs at up to 2 device pixels per logical unit. If a device keeps
dropping below ~45 fps, the game lowers its render resolution a step at a time
(never below 1×) and thins out particles; gameplay logic is unaffected.
Enemies, projectiles, pickups and effects are pooled.

## Testing hooks

`?debug` exposes `window.__FP__` (state/audio inspection, forced rescues, time
control) for the automated tests. `?autopilot&speed=3` lets a simple bot play
(used to verify full-run pacing). Neither affects normal play.
