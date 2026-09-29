# Replacing the placeholder soundtrack with the real FALSE PROPHET stems

The game ships with five **temporary** synthesized stems so the layered-soundtrack
system can be demonstrated. Swapping in the real band recording is a file copy —
no code changes are needed as long as the exports follow the contract below.

## The five files

Put your exports here, overwriting the placeholders (keep the exact names):

| Band member | Stem          | File                                         |
| ----------- | ------------- | -------------------------------------------- |
| VEX         | Lead guitar   | `public/audio/music/fp_lead_guitar_loop.wav`   |
| ASH         | Rhythm guitar | `public/audio/music/fp_rhythm_guitar_loop.wav` |
| GRAVE       | Bass          | `public/audio/music/fp_bass_loop.wav`          |
| RIOT        | Drums         | `public/audio/music/fp_drums_loop.wav`         |
| NYX         | Vocals        | `public/audio/music/fp_vocals_loop.wav`        |

The paths are configured in `src/config/audioConfig.ts` (`STEM_FILES`). If you
ever rename a file, change it there.

## The export contract (all five files must match)

| Property         | Required value                                   |
| ---------------- | ------------------------------------------------ |
| Tempo            | **128 BPM**                                      |
| Time signature   | **4/4**                                          |
| Key              | **E minor**                                      |
| Length           | **16 bars**                                      |
| Duration         | **exactly 30.000 seconds**                       |
| Sample rate      | **48,000 Hz**                                    |
| Format           | **WAV, 16-bit PCM**                              |
| Channels         | **stereo**                                       |
| Samples          | **exactly 1,440,000 samples per channel**        |
| Start            | **bar 1, beat 1 lands on sample 0 — no count-in, no leading silence** |
| End              | **no reverb/delay tail after the loop point**    |

Why those numbers: at 128 BPM one beat is 0.46875 s, one bar (4 beats) is
1.875 s, and 16 bars are exactly 30.000 s = 1,440,000 samples at 48 kHz.

### How to export from your DAW

1. Set the project to **128 BPM, 4/4**.
2. Place the song section you want to loop so that it starts **exactly on a bar
   line** — ideally bar 1 of the project.
3. Set the export/loop range to **exactly 16 bars** starting at that bar line
   (e.g. bar 1 to bar 17).
4. Export each of the five instrument buses/tracks **separately** with the
   **same range**: 48 kHz, 16-bit PCM WAV, stereo. Turn off "normalize",
   "trim silence", "add tail", "dither to a different length" or anything else
   that changes the start or the length.
5. If your reverbs/delays ring past the end of bar 16, either print the tail
   back onto the start of the loop (so it wraps seamlessly) or cut it; the file
   must still be exactly 30.000 s.

### Why every stem must start from the identical timeline position

The game starts **all five files at the same instant** and loops them from
0 to 30 s forever. Stems for members the player has not rescued yet are simply
muted (their volume is zero) — they are still playing in the background. When a
bandmate is rescued, their stem fades in on the next bar line at the *current*
position of the song. If one stem was exported starting half a beat later than
the others, it will be half a beat late for the entire run. Export all five from
the same start bar with the same length and they will line up sample-for-sample.

### Leave headroom

Players hear anywhere from one stem alone up to all five together. The five
stems summed must not clip: mix so the **full band peaks around −3 dBFS or
lower** when all five play at once (the game also runs a gentle compressor and
limiter, but don't rely on them to rescue a clipping mix). Each individual stem
will naturally be quieter on its own — that's intended: the song literally gets
bigger as the band reunites.

## Check your files

```bash
npm run audio:verify
```

This reads every WAV header and reports sample rate, bit depth, channels,
frame count and duration, and fails loudly if anything is off. The automated
test suite (`npm test`) runs the same checks.

You can also listen in the game: **SETTINGS → STEM CHECK** starts all five
stems in sync and lets you toggle each one; every toggle lands on the next bar
line. If a stem sounds late or early against the others, its export start was
not aligned.

## Balancing stems in the game

Each stem has a playback gain in `src/config/audioConfig.ts`:

```ts
export const STEM_FILES = {
  lead:   { ..., gain: 0.5 },
  rhythm: { ..., gain: 0.62 },
  bass:   { ..., gain: 0.45 },
  drums:  { ..., gain: 0.8 },
  vocals: { ..., gain: 0.55 },
};
```

`gain` is linear (0.5 ≈ −6 dB). If, once all five are playing, the vocals feel
buried or the bass is too heavy, nudge these values. Other mix settings live in
`AUDIO_MIX` in the same file: the one-bar fade-in used when a stem enters
(`stemFadeIn`), the master level, the BREAKDOWN surge boost, and the bus
compressor/limiter.

## Regenerating the placeholders

The temporary stems are generated by a pure-Python script (standard library
only), so they can always be recreated:

```bash
npm run audio:generate    # python3 scripts/generate-placeholder-audio.py
```

It writes the five files and verifies them. Running it **overwrites** whatever
is in `public/audio/music/`, so don't run it after you've dropped in the real
stems.
