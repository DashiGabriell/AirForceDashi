#!/usr/bin/env python3
"""Original menu theme for Air Force Dashi — cinematic aviation anthem vibe.
Original composition (not a copy of any film score). Seamless loop."""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 44100
BPM = 118.0
BEAT = 60.0 / BPM
BAR = BEAT * 4.0
OUT = Path(__file__).resolve().parents[1] / "assets" / "audio" / "menu_theme.wav"

# Em natural-ish for drama; original motifs
ROOT = 82.41  # E2
SCALE = np.array([0, 2, 3, 5, 7, 8, 10, 12], dtype=np.float64)  # E natural minor degrees in semis


def midi_hz(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def note_hz(degree: int, octave: int = 0) -> float:
    # degree indexes SCALE; octave shifts in 12-semitone steps from E2
    base_midi = 40.0  # E2
    semis = float(SCALE[degree % len(SCALE)]) + 12.0 * (octave + degree // len(SCALE))
    return midi_hz(base_midi + semis)


def env_adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    ea, ed, er = int(a * SR), int(d * SR), int(r * SR)
    es = max(0, n - ea - ed - er)
    parts = []
    if ea > 0:
        parts.append(np.linspace(0.0, 1.0, ea, endpoint=False))
    if ed > 0:
        parts.append(np.linspace(1.0, s, ed, endpoint=False))
    if es > 0:
        parts.append(np.full(es, s))
    if er > 0:
        parts.append(np.linspace(s if es or ed or ea else 1.0, 0.0, er, endpoint=False))
    e = np.concatenate(parts) if parts else np.zeros(0)
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def saw(t: np.ndarray, f: float) -> np.ndarray:
    return signal.sawtooth(2.0 * np.pi * f * t)


def square(t: np.ndarray, f: float, duty: float = 0.5) -> np.ndarray:
    return signal.square(2.0 * np.pi * f * t, duty=duty)


def sine(t: np.ndarray, f: float) -> np.ndarray:
    return np.sin(2.0 * np.pi * f * t)


def noise(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(n)


def lowpass(x: np.ndarray, cutoff: float, order: int = 3) -> np.ndarray:
    nyq = SR * 0.5
    wn = min(max(cutoff / nyq, 1e-4), 0.99)
    b, a = signal.butter(order, wn, btype="low")
    return signal.filtfilt(b, a, x)


def highpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    nyq = SR * 0.5
    wn = min(max(cutoff / nyq, 1e-4), 0.99)
    b, a = signal.butter(order, wn, btype="high")
    return signal.filtfilt(b, a, x)


def bandpass(x: np.ndarray, low: float, high: float, order: int = 2) -> np.ndarray:
    nyq = SR * 0.5
    lo = min(max(low / nyq, 1e-4), 0.98)
    hi = min(max(high / nyq, lo + 1e-3), 0.99)
    b, a = signal.butter(order, [lo, hi], btype="band")
    return signal.filtfilt(b, a, x)


def supersaw(t: np.ndarray, f: float, voices: int = 5, detune: float = 0.12) -> np.ndarray:
    out = np.zeros_like(t)
    for i in range(voices):
        cents = (i - (voices - 1) * 0.5) * detune
        ff = f * (2.0 ** (cents / 1200.0))
        phase = i * 0.17
        out += saw(t + phase / max(ff, 1.0), ff)
    return out / voices


def place(buf: np.ndarray, start: int, clip: np.ndarray) -> None:
    end = min(len(buf), start + len(clip))
    if start >= len(buf) or end <= start:
        return
    buf[start:end] += clip[: end - start]


def kick(rng: np.random.Generator) -> np.ndarray:
    n = int(0.28 * SR)
    t = np.arange(n) / SR
    f = np.linspace(140.0, 42.0, n)
    body = np.sin(2.0 * np.pi * np.cumsum(f) / SR)
    click = highpass(noise(n, rng), 1200.0) * np.exp(-t * 55.0) * 0.35
    e = np.exp(-t * 14.0)
    return (body * e + click) * 0.95


def snare(rng: np.random.Generator) -> np.ndarray:
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    tone = sine(t, 180.0) * np.exp(-t * 28.0) * 0.35
    nse = bandpass(noise(n, rng), 800.0, 6500.0) * np.exp(-t * 18.0)
    return (tone + nse * 0.9) * 0.85


def hat(rng: np.random.Generator, open_: bool = False) -> np.ndarray:
    n = int((0.12 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    nse = highpass(noise(n, rng), 6000.0)
    decay = 12.0 if open_ else 55.0
    return nse * np.exp(-t * decay) * (0.28 if open_ else 0.22)


def tom(f: float) -> np.ndarray:
    n = int(0.2 * SR)
    t = np.arange(n) / SR
    ff = np.linspace(f, f * 0.7, n)
    return np.sin(2.0 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 16.0) * 0.55


def bass_note(f: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    wave = 0.65 * saw(t, f) + 0.35 * sine(t, f * 0.5)
    wave = lowpass(wave, min(900.0, f * 6.0), 2)
    e = env_adsr(n, 0.01, 0.08, 0.7, 0.08)
    return wave * e * 0.55


def pad_chord(freqs: list[float], dur: float, bright: float = 0.4) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        out += supersaw(t, f, voices=5, detune=0.18) * 0.55
        out += sine(t, f * 0.5) * 0.2
    out /= max(1.0, len(freqs) * 0.65)
    out = lowpass(out, 1800.0 + bright * 2200.0, 2)
    e = env_adsr(n, 0.35, 0.4, 0.75, 0.5)
    # soft gate shimmer (aviation-synth feel) without harsh chopping
    gate = 0.82 + 0.18 * (0.5 + 0.5 * np.sin(2.0 * np.pi * (2.0 / BEAT) * t))
    return out * e * gate * 0.42


def brass_stab(freqs: list[float], dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        out += supersaw(t, f, 6, 0.22) * 0.5
        out += square(t, f * 0.5, 0.4) * 0.2
    out /= max(1.0, len(freqs) * 0.55)
    out = lowpass(out, 3200.0, 2)
    e = env_adsr(n, 0.02, 0.12, 0.45, 0.18)
    return out * e * 0.5


def lead_note(f: float, dur: float, vib: float = 4.5) -> np.ndarray:
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    vib_f = f * (1.0 + 0.004 * np.sin(2.0 * np.pi * vib * t))
    # integrate phase for vibrato
    phase = 2.0 * np.pi * np.cumsum(vib_f) / SR
    wave = 0.55 * signal.sawtooth(phase) + 0.25 * np.sin(phase) + 0.2 * signal.square(phase, 0.35)
    wave = lowpass(wave, min(4500.0, f * 8.0), 2)
    e = env_adsr(n, 0.02, 0.1, 0.65, min(0.2, dur * 0.35))
    return wave * e * 0.38


def write_wav(path: Path, samples: np.ndarray) -> None:
    samples = np.asarray(samples, dtype=np.float64)
    # soft limiter
    peak = np.max(np.abs(samples)) + 1e-9
    samples = samples / peak
    samples = np.tanh(samples * 1.15) * 0.92
    pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"wrote {path} ({len(pcm) / SR:.2f}s, peak={peak:.2f})")


def seamless(x: np.ndarray, fade: float = 0.12) -> np.ndarray:
    n = len(x)
    fn = min(int(fade * SR), n // 8)
    out = x.copy()
    ramp = np.linspace(0.0, 1.0, fn)
    head = out[:fn].copy()
    tail = out[-fn:].copy()
    mixed = tail * (1.0 - ramp) + head * ramp
    out[:fn] = mixed
    out[-fn:] = mixed
    return out


def build() -> np.ndarray:
    rng = np.random.default_rng(42)
    bars = 16
    total = int(bars * BAR * SR)
    mix = np.zeros(total)

    # Chord progression (original): Em – C – G – D  /  Em – Am – Bm – D
    # degrees relative to E minor
    prog = [
        [0, 2, 4],  # Em
        [5, 0, 2],  # C (relative)
        [2, 4, 6],  # G
        [6, 1, 3],  # D
        [0, 2, 4],  # Em
        [3, 5, 0],  # Am
        [4, 6, 1],  # Bm
        [6, 1, 3],  # D
    ]

    # Drums
    k = kick(rng)
    s = snare(rng)
    h = hat(rng, False)
    ho = hat(rng, True)
    for bar in range(bars):
        t0 = int(bar * BAR * SR)
        # four-on-floor with backbeat snare — anthemic
        for b in range(4):
            place(mix, t0 + int(b * BEAT * SR), k * (1.0 if b % 2 == 0 else 0.85))
            place(mix, t0 + int((b + 0.5) * BEAT * SR), h)
            if b in (1, 3):
                place(mix, t0 + int(b * BEAT * SR), s)
            if b == 2:
                place(mix, t0 + int((b + 0.75) * BEAT * SR), ho * 0.7)
        # fill last bar of each 8
        if bar % 8 == 7:
            place(mix, t0 + int(2.5 * BEAT * SR), tom(120.0))
            place(mix, t0 + int(3.0 * BEAT * SR), tom(95.0))
            place(mix, t0 + int(3.5 * BEAT * SR), s * 1.1)

    # Pads + bass + stabs per bar
    for bar in range(bars):
        t0 = int(bar * BAR * SR)
        ch = prog[bar % len(prog)]
        freqs = [note_hz(d, octave=1) for d in ch]
        bright = 0.55 if bar >= 8 else 0.35
        place(mix, t0, pad_chord(freqs, BAR * 1.02, bright=bright))
        # bass pattern: root on 1+3, fifth pulse
        root = note_hz(ch[0], octave=0)
        fifth = note_hz((ch[0] + 4) % len(SCALE), octave=0)
        place(mix, t0, bass_note(root, BEAT * 1.05))
        place(mix, t0 + int(1.0 * BEAT * SR), bass_note(root, BEAT * 0.9) * 0.85)
        place(mix, t0 + int(2.0 * BEAT * SR), bass_note(fifth, BEAT * 1.0))
        place(mix, t0 + int(3.0 * BEAT * SR), bass_note(root, BEAT * 0.85) * 0.9)
        # brass stabs on offbeats in second half
        if bar >= 4:
            place(mix, t0 + int(1.5 * BEAT * SR), brass_stab(freqs, BEAT * 0.45) * 0.75)
        if bar >= 8 and bar % 2 == 0:
            place(mix, t0 + int(3.5 * BEAT * SR), brass_stab([f * 2 for f in freqs[:2]], BEAT * 0.35) * 0.65)

    # Lead motifs (original) — soaring call/response
    # Motif A (bars 0-7): rising hero line
    motif_a = [
        # (bar_offset_beats, degree, octave, duration_beats)
        (0.0, 4, 2, 1.0),
        (1.0, 5, 2, 0.5),
        (1.5, 6, 2, 0.5),
        (2.0, 7, 2, 1.5),
        (4.0, 6, 2, 0.5),
        (4.5, 5, 2, 0.5),
        (5.0, 4, 2, 1.0),
        (6.0, 2, 2, 2.0),
    ]
    motif_b = [
        (0.0, 0, 3, 0.75),
        (0.75, 2, 3, 0.75),
        (1.5, 4, 3, 0.5),
        (2.0, 5, 3, 1.5),
        (4.0, 4, 3, 0.5),
        (4.5, 3, 3, 0.5),
        (5.0, 2, 3, 1.0),
        (6.0, 0, 3, 1.0),
        (7.0, 6, 2, 1.0),
    ]
    for bar in range(0, 8, 2):
        base = bar * BAR
        for beat_off, deg, octv, dur_b in motif_a:
            f = note_hz(deg, octv)
            place(mix, int((base + beat_off * BEAT) * SR), lead_note(f, dur_b * BEAT * 0.95))
    for bar in range(8, 16, 2):
        base = bar * BAR
        for beat_off, deg, octv, dur_b in motif_b:
            f = note_hz(deg, octv)
            place(mix, int((base + beat_off * BEAT) * SR), lead_note(f, dur_b * BEAT * 0.95, vib=5.2))

    # Air / jet whoosh texture under chorus
    for bar in range(8, 16):
        t0 = int(bar * BAR * SR)
        n = int(BAR * SR)
        whoosh = bandpass(noise(n, rng), 200.0, 1600.0)
        whoosh *= env_adsr(n, 0.2, 0.3, 0.5, 0.4) * 0.08
        place(mix, t0, whoosh)

    # Subtle riser into bar 8
    n = int(2.0 * BAR * SR)
    t = np.arange(n) / SR
    f0, f1 = 55.0, 160.0
    freq = f0 + (f1 - f0) * (t / max(t[-1], 1e-6))
    phase = 2.0 * np.pi * np.cumsum(freq) / SR
    riser = signal.sawtooth(phase) * 0.6 + np.sin(phase) * 0.4
    cut = 400.0 + 3000.0 * (t / max(t[-1], 1e-6))
    # piecewise lowpass approximation via amplitude shaping + mild filter
    riser = lowpass(riser, 3500.0, 2)
    riser *= (cut / 3400.0).clip(0.15, 1.0)
    riser *= np.linspace(0.0, 1.0, n) ** 2 * 0.25
    place(mix, int(6 * BAR * SR), riser)

    mix = lowpass(mix, 14000.0, 1)
    mix = seamless(mix, fade=0.15)
    return mix


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    audio = build()
    write_wav(OUT, audio)


if __name__ == "__main__":
    main()
