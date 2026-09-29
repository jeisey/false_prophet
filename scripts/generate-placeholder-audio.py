#!/usr/bin/env python3
"""
Generate the five TEMPORARY FALSE PROPHET soundtrack stems.

Pure Python standard library. No external music, no downloads, fully
reproducible (fixed random seeds).

Specification (must match src/config/audioConfig.ts):
  * 128 BPM, 4/4, E minor, 16 bars  -> exactly 30.000 seconds
  * 48,000 Hz, 16-bit PCM, stereo   -> exactly 1,440,000 samples per channel
  * bar 1 downbeat at sample 0, no count-in, no tail past the loop point
    (anything that would ring past the end is wrapped back to the start so
    the loop is seamless)

The music is intentionally crude. Its job is to prove the stem system:
five distinguishable parts that line up perfectly and sound like one song
when layered.

Usage:
  python3 scripts/generate-placeholder-audio.py            # writes public/audio/music/*.wav
  python3 scripts/generate-placeholder-audio.py --verify   # only verify existing files
"""

import math
import os
import random
import struct
import sys
import wave
from array import array

# --------------------------------------------------------------------------
# Timeline
# --------------------------------------------------------------------------
SR = 48_000
BPM = 128
BEATS_PER_BAR = 4
BARS = 16
BEAT = 60.0 / BPM                      # 0.46875 s
SAMPLES_PER_BEAT = int(round(BEAT * SR))  # 22,500
SIXTEENTH = SAMPLES_PER_BEAT // 4         # 5,625 (exact)
SAMPLES_PER_BAR = SAMPLES_PER_BEAT * BEATS_PER_BAR  # 90,000
N = SAMPLES_PER_BAR * BARS                # 1,440,000
assert N == 1_440_000
assert SIXTEENTH * 4 == SAMPLES_PER_BEAT

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'audio', 'music')
FILES = {
    'lead': 'fp_lead_guitar_loop.wav',
    'rhythm': 'fp_rhythm_guitar_loop.wav',
    'bass': 'fp_bass_loop.wav',
    'drums': 'fp_drums_loop.wav',
    'vocals': 'fp_vocals_loop.wav',
}

TWO_PI = 2.0 * math.pi


def midi_hz(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


def pos(bar, sixteenth):
    """Sample index of a 16th-note grid position (bar is 0-based)."""
    return bar * SAMPLES_PER_BAR + sixteenth * SIXTEENTH


class Stereo:
    """Circular stereo buffer: writes past the end wrap to the start."""

    def __init__(self):
        self.l = array('d', bytes(8 * N))
        self.r = array('d', bytes(8 * N))

    def add(self, start, mono, gain_l, gain_r):
        l, r = self.l, self.r
        n = len(mono)
        start %= N
        first = min(n, N - start)
        for i in range(first):
            s = mono[i]
            l[start + i] += s * gain_l
            r[start + i] += s * gain_r
        # wrap remainder to the loop start (seamless tail)
        for i in range(first, n):
            s = mono[i]
            j = i - first
            l[j] += s * gain_l
            r[j] += s * gain_r

    def normalize(self, peak_target):
        peak = max(max(abs(v) for v in self.l), max(abs(v) for v in self.r))
        if peak <= 0:
            return
        k = peak_target / peak
        for i in range(N):
            self.l[i] *= k
            self.r[i] *= k


def pan_gains(p):
    """Equal-power pan, p in [-1, 1]."""
    a = (p + 1.0) * math.pi / 4.0
    return math.cos(a), math.sin(a)


def one_pole_lp(samples, cutoff):
    a = 1.0 - math.exp(-TWO_PI * cutoff / SR)
    y = 0.0
    out = [0.0] * len(samples)
    for i, x in enumerate(samples):
        y += a * (x - y)
        out[i] = y
    return out


def fade_edges(samples, attack=0.002, release=0.012):
    n = len(samples)
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    for i in range(min(a, n)):
        samples[i] *= i / a
    for i in range(min(r, n)):
        samples[n - 1 - i] *= i / r
    return samples


# --------------------------------------------------------------------------
# Harmony: one chord root per bar (E minor progression)
# --------------------------------------------------------------------------
E2, G2, A2, B2, C3, D3 = 40, 43, 45, 47, 48, 50
CHORDS = [E2, E2, C3, D3, E2, E2, A2, B2, E2, E2, G2, D3, C3, A2, B2, B2]
GALLOP = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]


# --------------------------------------------------------------------------
# RHYTHM GUITAR — distorted palm-muted power-chord chugs, double tracked
# --------------------------------------------------------------------------
def render_power_chord(root, length, muted, detune_cents, seed):
    rnd = random.Random(seed)
    freqs = [midi_hz(root), midi_hz(root + 7), midi_hz(root + 12)]
    det = 2.0 ** (detune_cents / 1200.0)
    freqs = [f * det for f in freqs]
    phases = [rnd.random() for _ in freqs]
    incs = [f / SR for f in freqs]
    decay = 16.0 if muted else 1.6
    drive = 7.0 if muted else 5.0
    out = [0.0] * length
    tanh = math.tanh
    exp = math.exp
    for i in range(length):
        s = 0.0
        for k in range(3):
            ph = phases[k] + incs[k]
            if ph >= 1.0:
                ph -= 1.0
            phases[k] = ph
            s += 2.0 * ph - 1.0
        env = exp(-decay * i / SR)
        out[i] = tanh(s * drive * (0.35 + 0.65 * env)) * env
    out = one_pole_lp(out, 1100.0 if muted else 2600.0)
    out = one_pole_lp(out, 3200.0)
    return fade_edges(out, 0.002, 0.01)


def build_rhythm():
    buf = Stereo()
    cache = {}
    for side, detune, offset, pan in (('L', -4.0, 0, -0.75), ('R', 4.0, 72, 0.75)):
        gl, gr = pan_gains(pan)
        for bar, root in enumerate(CHORDS):
            e_bar = root == E2
            hits = []
            if e_bar:
                hits = [(s, True) for s in GALLOP]
            else:
                # open chord on the downbeat, then chugs
                hits = [(0, False)] + [(s, True) for s in (8, 10, 11, 12, 14, 15)]
            if bar == 15:
                hits = [(0, False), (8, False), (12, True), (13, True), (14, True), (15, True)]
            for s16, muted in hits:
                if muted:
                    length = int(SIXTEENTH * 0.92)
                else:
                    length = SIXTEENTH * 8 - 200
                key = (root, length, muted, side)
                if key not in cache:
                    cache[key] = render_power_chord(root, length, muted, detune, hash(key) & 0xFFFF)
                buf.add(pos(bar, s16) + offset, cache[key], gl, gr)
    buf.normalize(0.42)
    return buf


# --------------------------------------------------------------------------
# BASS — gritty low saw following chord roots in 8ths
# --------------------------------------------------------------------------
def render_bass_note(midi, length):
    f = midi_hz(midi)
    inc = f / SR
    inc2 = inc * 0.5
    ph = 0.0
    ph2 = 0.0
    out = [0.0] * length
    exp = math.exp
    tanh = math.tanh
    for i in range(length):
        ph += inc
        if ph >= 1.0:
            ph -= 1.0
        ph2 += inc2
        if ph2 >= 1.0:
            ph2 -= 1.0
        saw = 2.0 * ph - 1.0
        sub = math.sin(TWO_PI * ph2) * 0.5
        env = 0.55 + 0.45 * exp(-9.0 * i / SR)
        out[i] = tanh((saw * 1.6 + sub) * 1.4) * env
    out = one_pole_lp(out, 520.0)
    out = one_pole_lp(out, 900.0)
    return fade_edges(out, 0.003, 0.015)


def build_bass():
    buf = Stereo()
    cache = {}
    for bar, root in enumerate(CHORDS):
        broot = root - 12
        pattern = []
        for s16 in range(0, 16, 2):
            m = broot
            if s16 == 14 and root == E2:
                m = broot + 12  # octave pop on the last 8th
            if s16 == 6 and bar % 4 == 1:
                m = broot + 7
            pattern.append((s16, m, SIXTEENTH * 2 - 300))
        if bar in (1, 5, 9):
            # gallop fill to lock with the rhythm guitar
            pattern = [(s, broot, SIXTEENTH - 200) for s in GALLOP]
        if bar == 15:
            pattern = [(0, broot, SIXTEENTH * 4 - 300), (4, broot, SIXTEENTH * 2 - 300),
                       (6, broot + 3, SIXTEENTH * 2 - 300), (8, broot + 5, SIXTEENTH * 2 - 300),
                       (10, broot + 7, SIXTEENTH * 2 - 300), (12, broot + 8, SIXTEENTH * 2 - 300),
                       (14, broot + 10, SIXTEENTH * 2 - 300)]
        for s16, m, length in pattern:
            key = (m, length)
            if key not in cache:
                cache[key] = render_bass_note(m, length)
            buf.add(pos(bar, s16), cache[key], 0.707, 0.707)
    buf.normalize(0.45)
    return buf


# --------------------------------------------------------------------------
# DRUMS — synthetic kick / snare / hats / crash
# --------------------------------------------------------------------------
def render_kick():
    length = int(0.32 * SR)
    out = [0.0] * length
    ph = 0.0
    exp = math.exp
    for i in range(length):
        t = i / SR
        f = 46.0 + 120.0 * exp(-t * 32.0)
        ph += f / SR
        env = exp(-t * 8.5)
        click = exp(-t * 400.0) * 0.6
        out[i] = math.sin(TWO_PI * ph) * env + click
    return fade_edges(out, 0.0005, 0.02)


def render_snare(seed=7):
    rnd = random.Random(seed)
    length = int(0.24 * SR)
    out = [0.0] * length
    lp = 0.0
    exp = math.exp
    for i in range(length):
        t = i / SR
        n = rnd.uniform(-1.0, 1.0)
        lp += 0.35 * (n - lp)
        noise = (n - lp) * exp(-t * 16.0)
        tone = math.sin(TWO_PI * 188.0 * t) * exp(-t * 28.0) * 0.8
        out[i] = noise * 0.9 + tone
    return fade_edges(out, 0.0005, 0.02)


def render_hat(seed, decay=70.0, length_s=0.09):
    rnd = random.Random(seed)
    length = int(length_s * SR)
    out = [0.0] * length
    lp = 0.0
    exp = math.exp
    for i in range(length):
        t = i / SR
        n = rnd.uniform(-1.0, 1.0)
        lp += 0.6 * (n - lp)
        out[i] = (n - lp) * exp(-t * decay)
    return fade_edges(out, 0.0003, 0.01)


def render_crash(seed=99):
    rnd = random.Random(seed)
    length = int(1.6 * SR)
    out = [0.0] * length
    lp = 0.0
    exp = math.exp
    for i in range(length):
        t = i / SR
        n = rnd.uniform(-1.0, 1.0)
        lp += 0.45 * (n - lp)
        shimmer = 0.75 + 0.25 * math.sin(TWO_PI * 7.0 * t)
        out[i] = (n - lp) * exp(-t * 2.4) * shimmer
    return fade_edges(out, 0.0005, 0.08)


def build_drums():
    buf = Stereo()
    kick = render_kick()
    snare = render_snare()
    hats = [render_hat(100 + k) for k in range(4)]
    open_hat = render_hat(200, decay=14.0, length_s=0.25)
    crash = render_crash()
    for bar in range(BARS):
        if bar >= 12 and bar < 15:
            kicks = list(range(16))  # double-kick build
        elif bar == 15:
            kicks = [0, 2, 3, 6, 8]
        else:
            kicks = [0, 2, 3, 8, 10, 11] if bar % 2 == 0 else [0, 3, 6, 8, 10, 11, 14]
        snares = [4, 12]
        if bar == 15:
            snares = [4, 10, 12, 13, 14, 15]
        if bar == 7:
            snares = [4, 12, 14, 15]
        for s in kicks:
            g = 0.95 if s % 4 == 0 else 0.8
            buf.add(pos(bar, s), kick, g, g)
        for s in snares:
            g = 0.85 if s in (4, 12) else 0.6
            buf.add(pos(bar, s), snare, g * 0.95, g)
        for s in range(0, 16, 2):
            if bar == 15 and s >= 10:
                continue
            h = hats[(bar + s) % 4]
            g = 0.32 if s % 4 == 0 else 0.22
            gl, gr = pan_gains(0.35)
            buf.add(pos(bar, s), h, g * gl, g * gr)
        if bar % 4 == 3:
            gl, gr = pan_gains(0.3)
            buf.add(pos(bar, 14), open_hat, 0.3 * gl, 0.3 * gr)
        if bar in (0, 8, 12):
            gl, gr = pan_gains(-0.4)
            buf.add(pos(bar, 0), crash, 0.55 * gl, 0.55 * gr)
            gl, gr = pan_gains(0.45)
            buf.add(pos(bar, 0), crash, 0.25 * gl, 0.25 * gr)
    buf.normalize(0.5)
    return buf


# --------------------------------------------------------------------------
# LEAD GUITAR — saw/square lead with vibrato, drive, melody + shred runs
# --------------------------------------------------------------------------
def lead_bar_notes():
    s = []  # (bar, start16, len16, midi, vibrato)
    def add(bar, notes):
        for n in notes:
            st, ln, m = n[0], n[1], n[2]
            vib = n[3] if len(n) > 3 else ln >= 6
            s.append((bar, st, ln, m, vib))

    b1 = [(0, 3, 76), (3, 1, 74), (4, 2, 71), (6, 2, 74), (8, 4, 76), (12, 2, 79), (14, 2, 78)]
    add(0, b1)
    add(1, [(0, 6, 76), (6, 2, 71), (8, 4, 74), (12, 4, 71)])
    add(2, [(0, 4, 72), (4, 2, 76), (6, 2, 79), (8, 6, 76), (14, 2, 74)])
    add(3, [(0, 4, 74), (4, 2, 78), (6, 2, 81), (8, 4, 78), (12, 4, 74)])
    add(4, b1)
    add(5, [(0, 4, 79), (4, 4, 78), (8, 8, 76)])
    add(6, [(0, 4, 76), (4, 2, 72), (6, 2, 69), (8, 4, 72), (12, 4, 76)])
    add(7, [(0, 4, 75), (4, 2, 78), (6, 2, 83), (8, 8, 78)])
    add(8, [(0, 8, 83), (8, 2, 81), (10, 2, 79), (12, 4, 78)])
    add(9, [(0, 4, 76), (4, 4, 79), (8, 8, 83)])
    add(10, [(0, 4, 79), (4, 2, 83), (6, 2, 86), (8, 8, 83)])
    add(11, [(0, 4, 81), (4, 4, 78), (8, 8, 74)])
    runs = {
        12: [72, 76, 79, 84, 79, 76, 72, 76, 79, 84, 88, 84, 79, 76, 72, 67],
        13: [69, 72, 76, 81, 76, 72, 69, 72, 76, 81, 84, 81, 76, 72, 69, 64],
        14: [71, 75, 78, 81, 83, 81, 78, 75, 71, 75, 78, 83, 87, 83, 78, 75],
    }
    for bar, seq in runs.items():
        add(bar, [(i, 1, m, False) for i, m in enumerate(seq)])
    add(15, [(0, 2, 83), (2, 2, 81), (4, 2, 79), (6, 2, 78), (8, 2, 76), (10, 2, 75), (12, 4, 76, True)])
    return s


def render_lead_note(midi, length, vibrato, seed):
    rnd = random.Random(seed)
    f = midi_hz(midi)
    ph = rnd.random()
    ph2 = rnd.random()
    out = [0.0] * length
    tanh = math.tanh
    exp = math.exp
    sin = math.sin
    for i in range(length):
        t = i / SR
        vib = 0.0
        if vibrato and t > 0.12:
            depth = min(1.0, (t - 0.12) / 0.2) * 0.012
            vib = sin(TWO_PI * 5.8 * t) * depth
        fi = f * (1.0 + vib)
        ph += fi / SR
        if ph >= 1.0:
            ph -= 1.0
        ph2 += fi * 1.004 / SR
        if ph2 >= 1.0:
            ph2 -= 1.0
        saw = 2.0 * ph - 1.0
        sq = 1.0 if ph2 < 0.5 else -1.0
        env = 0.7 + 0.3 * exp(-t * 6.0)
        out[i] = tanh((saw * 0.7 + sq * 0.4) * 3.2) * env
    out = one_pole_lp(out, 3400.0)
    out = one_pole_lp(out, 5200.0)
    return fade_edges(out, 0.004, 0.025)


def build_lead():
    buf = Stereo()
    gl, gr = pan_gains(-0.15)
    cache = {}
    for bar, st, ln, m, vib in lead_bar_notes():
        length = ln * SIXTEENTH - (150 if ln == 1 else 400)
        key = (m, length, vib)
        if key not in cache:
            cache[key] = render_lead_note(m, length, vib, m * 31 + ln)
        g = 0.85 if ln == 1 else 1.0
        buf.add(pos(bar, st), cache[key], g * gl, g * gr)
        # short slap-back echo (kept inside the loop via wrap)
        buf.add(pos(bar, st) + int(0.1875 * SR), cache[key], 0.18 * gr, 0.18 * gl)
    buf.normalize(0.4)
    return buf


# --------------------------------------------------------------------------
# VOCALS — formant-synth surrogate: sung vowels, shouts, growls
# --------------------------------------------------------------------------
FORMANTS = {
    'a': [(730, 1.0, 90), (1090, 0.5, 110), (2440, 0.25, 160)],
    'o': [(570, 1.0, 80), (840, 0.45, 100), (2410, 0.15, 160)],
    'e': [(530, 1.0, 80), (1840, 0.4, 130), (2480, 0.25, 160)],
}


def bandpass_coeffs(fc, bw):
    w0 = TWO_PI * fc / SR
    q = fc / bw
    alpha = math.sin(w0) / (2 * q)
    b0 = alpha
    a0 = 1 + alpha
    a1 = -2 * math.cos(w0)
    a2 = 1 - alpha
    return b0 / a0, a1 / a0, a2 / a0


def render_voice(midi, length, vowel, style, seed):
    rnd = random.Random(seed)
    f0 = midi_hz(midi)
    ph = 0.0
    out = [0.0] * length
    filters = []
    for fc, gain, bw in FORMANTS[vowel]:
        b0, a1, a2 = bandpass_coeffs(fc * (1.08 if style == 'shout' else 1.0), bw * (2.0 if style == 'growl' else 1.0))
        filters.append([b0, a1, a2, gain, 0.0, 0.0, 0.0, 0.0])
    noise_amt = {'sing': 0.08, 'shout': 0.35, 'growl': 0.85}[style]
    exp = math.exp
    sin = math.sin
    tanh = math.tanh
    for i in range(length):
        t = i / SR
        vib = sin(TWO_PI * 5.2 * t) * 0.01 * min(1.0, t / 0.25) if style == 'sing' else 0.0
        f = f0 * (1.0 + vib)
        if style == 'shout':
            f *= 1.0 + 0.04 * exp(-t * 10.0)
        ph += f / SR
        if ph >= 1.0:
            ph -= 1.0
        src = 2.0 * ph - 1.0
        n = rnd.uniform(-1.0, 1.0)
        if style == 'growl':
            rattle = 0.55 + 0.45 * sin(TWO_PI * 31.0 * t)
            src = (src * 0.5 + n * noise_amt) * rattle
        else:
            src = src + n * noise_amt
        y = 0.0
        for flt in filters:
            b0, a1, a2, g, x1, x2, y1, y2 = flt
            yy = b0 * src - b0 * x2 - a1 * y1 - a2 * y2
            flt[4] = src
            flt[5] = x1
            flt[6] = yy
            flt[7] = y1
            y += yy * g
        if style == 'sing':
            env = min(1.0, t / 0.05)
        elif style == 'shout':
            env = min(1.0, t / 0.01) * (0.6 + 0.4 * exp(-t * 5.0))
        else:
            env = min(1.0, t / 0.008) * exp(-t * 2.5)
        out[i] = tanh(y * (5.0 if style != 'sing' else 3.2)) * env
    return fade_edges(out, 0.005, 0.04)


VOCAL_LINES = {
    0: [(0, 4, 52, 'o', 'growl'), (8, 2, 52, 'a', 'shout'), (12, 2, 55, 'a', 'shout')],
    1: [(0, 8, 59, 'a', 'sing'), (8, 8, 57, 'o', 'sing')],
    2: [(0, 8, 55, 'a', 'sing'), (8, 6, 60, 'e', 'sing')],
    3: [(0, 12, 57, 'o', 'sing')],
    4: [(0, 4, 52, 'o', 'growl'), (8, 2, 52, 'a', 'shout'), (12, 2, 55, 'a', 'shout')],
    5: [(0, 8, 59, 'a', 'sing'), (8, 8, 62, 'o', 'sing')],
    6: [(0, 8, 60, 'a', 'sing'), (8, 8, 57, 'e', 'sing')],
    7: [(0, 12, 59, 'o', 'sing'), (12, 4, 63, 'a', 'sing')],
    8: [(0, 6, 64, 'a', 'sing'), (6, 2, 62, 'o', 'sing'), (8, 8, 59, 'a', 'sing')],
    9: [(0, 4, 52, 'o', 'growl'), (4, 4, 52, 'o', 'growl'), (8, 8, 64, 'a', 'sing')],
    10: [(0, 8, 67, 'a', 'sing'), (8, 8, 66, 'o', 'sing')],
    11: [(0, 16, 62, 'a', 'sing')],
    12: [(0, 4, 48, 'o', 'growl'), (4, 4, 48, 'a', 'growl'), (8, 4, 48, 'o', 'growl'), (12, 4, 48, 'a', 'growl')],
    13: [(0, 4, 45, 'o', 'growl'), (4, 4, 45, 'a', 'growl'), (8, 8, 64, 'a', 'shout')],
    14: [(0, 8, 59, 'a', 'sing'), (8, 8, 63, 'e', 'sing')],
    15: [(0, 8, 64, 'o', 'sing'), (8, 4, 52, 'a', 'growl'), (12, 4, 52, 'a', 'shout')],
}


def build_vocals():
    buf = Stereo()
    cache = {}
    for bar, notes in VOCAL_LINES.items():
        for st, ln, m, vowel, style in notes:
            length = ln * SIXTEENTH - 500
            key = (m, length, vowel, style)
            if key not in cache:
                cache[key] = render_voice(m, length, vowel, style, bar * 100 + st)
            g = {'sing': 1.0, 'shout': 0.95, 'growl': 0.9}[style]
            buf.add(pos(bar, st), cache[key], g * 0.72, g * 0.72)
            # doubled a hair late on the right for width
            buf.add(pos(bar, st) + 360, cache[key], g * 0.18, g * 0.3)
    buf.normalize(0.4)
    return buf


# --------------------------------------------------------------------------
# WAV I/O + verification
# --------------------------------------------------------------------------
def write_wav(path, buf):
    frames = array('h', bytes(2 * 2 * N))
    l, r = buf.l, buf.r
    for i in range(N):
        a = int(round(max(-1.0, min(1.0, l[i])) * 32767))
        b = int(round(max(-1.0, min(1.0, r[i])) * 32767))
        frames[2 * i] = a
        frames[2 * i + 1] = b
    if sys.byteorder == 'big':
        frames.byteswap()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames.tobytes())


def verify(path):
    with wave.open(path, 'rb') as w:
        ch, sw, fr, nf = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        comp = w.getcomptype()
    problems = []
    if ch != 2:
        problems.append('channels=%d (want 2)' % ch)
    if sw != 2:
        problems.append('sample width=%d bytes (want 2 = 16-bit)' % sw)
    if fr != SR:
        problems.append('sample rate=%d (want %d)' % (fr, SR))
    if nf != N:
        problems.append('frames=%d (want %d)' % (nf, N))
    if comp != 'NONE':
        problems.append('compression=%s (want PCM)' % comp)
    return (ch, sw, fr, nf, nf / fr), problems


def main():
    verify_only = '--verify' in sys.argv
    os.makedirs(OUT_DIR, exist_ok=True)
    builders = {
        'drums': build_drums,
        'bass': build_bass,
        'rhythm': build_rhythm,
        'lead': build_lead,
        'vocals': build_vocals,
    }
    if not verify_only:
        for stem, fn in builders.items():
            path = os.path.join(OUT_DIR, FILES[stem])
            print('rendering %-7s -> %s' % (stem, os.path.relpath(path)), flush=True)
            write_wav(path, fn())
    ok = True
    for stem in ('lead', 'rhythm', 'bass', 'drums', 'vocals'):
        path = os.path.join(OUT_DIR, FILES[stem])
        if not os.path.exists(path):
            print('MISSING %s' % path)
            ok = False
            continue
        (ch, sw, fr, nf, dur), problems = verify(path)
        status = 'OK ' if not problems else 'BAD'
        print('%s %-28s %d ch  %2d-bit  %d Hz  %d frames  %.6f s' % (status, FILES[stem], ch, sw * 8, fr, nf, dur))
        for p in problems:
            print('    - ' + p)
        ok = ok and not problems
    if not ok:
        sys.exit(1)
    print('All stems: 128 BPM, 4/4, 16 bars = 30.000 s, 48 kHz, 16-bit PCM stereo.')


if __name__ == '__main__':
    main()
