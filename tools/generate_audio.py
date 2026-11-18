#!/usr/bin/env python3
"""Generate layered jet SFX WAVs for Patrol (offline bake, not runtime synth)."""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 44100
OUT = Path(__file__).resolve().parents[1] / "assets" / "audio"


def write_wav(path: Path, samples: np.ndarray) -> None:
    samples = np.asarray(samples, dtype=np.float64)
    peak = np.max(np.abs(samples))
    if peak > 1e-9:
        samples = samples / peak * 0.92
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype(np.int16)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  wrote {path.name} ({len(pcm) / SR:.2f}s)")


def pink_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    white = rng.standard_normal(n)
    freqs = np.fft.rfftfreq(n, 1.0 / SR)
    spectrum = np.fft.rfft(white)
    spectrum[1:] /= np.sqrt(np.maximum(freqs[1:], 1.0))
    spectrum[0] = 0
    out = np.fft.irfft(spectrum, n=n)
    return out / (np.max(np.abs(out)) + 1e-9)


def brown_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    white = rng.standard_normal(n)
    brown = np.cumsum(white)
    brown -= np.mean(brown)
    return brown / (np.max(np.abs(brown)) + 1e-9)


def bandpass(x: np.ndarray, low: float, high: float, order: int = 4) -> np.ndarray:
    nyq = SR * 0.5
    low_n = max(low / nyq, 1e-5)
    high_n = min(high / nyq, 0.999)
    if low_n >= high_n:
        return x * 0.0
    b, a = signal.butter(order, [low_n, high_n], btype="band")
    return signal.filtfilt(b, a, x)


def lowpass(x: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    nyq = SR * 0.5
    wn = min(cutoff / nyq, 0.999)
    b, a = signal.butter(order, wn, btype="low")
    return signal.filtfilt(b, a, x)


def highpass(x: np.ndarray, cutoff: float, order: int = 3) -> np.ndarray:
    nyq = SR * 0.5
    wn = max(cutoff / nyq, 1e-5)
    b, a = signal.butter(order, wn, btype="high")
    return signal.filtfilt(b, a, x)


def seamless_loop(x: np.ndarray, fade: float = 0.08) -> np.ndarray:
    n = len(x)
    fade_n = max(1, int(fade * SR))
    fade_n = min(fade_n, n // 4)
    out = x.copy()
    ramp = np.linspace(0.0, 1.0, fade_n)
    head = out[:fade_n]
    tail = out[-fade_n:]
    mixed = head * ramp + tail * (1.0 - ramp)
    out[:fade_n] = mixed
    out[-fade_n:] = mixed
    return out


def turbine_whine(n: int, base_hz: float, rng: np.random.Generator) -> np.ndarray:
    t = np.arange(n) / SR
    vib = 1.0 + 0.012 * np.sin(2 * np.pi * 3.1 * t)
    vib += 0.006 * np.sin(2 * np.pi * 7.4 * t + 0.7)
    phase = 2 * np.pi * base_hz * np.cumsum(vib) / SR
    tone = np.sin(phase) * 0.55
    tone += 0.28 * np.sin(phase * 2.01)
    tone += 0.12 * np.sin(phase * 3.03)
    hiss = highpass(pink_noise(n, rng), 1800.0) * 0.18
    return tone + hiss


def make_engine_loop(seconds: float = 2.4) -> np.ndarray:
    rng = np.random.default_rng(42)
    n = int(seconds * SR)
    rumble = lowpass(brown_noise(n, rng), 110.0) * 0.95
    roar = bandpass(pink_noise(n, rng), 120.0, 700.0) * 0.72
    mid = bandpass(pink_noise(n, rng), 700.0, 2200.0) * 0.28
    whine = turbine_whine(n, 2850.0, rng) * 0.16
    t = np.arange(n) / SR
    breath = 0.88 + 0.12 * np.sin(2 * np.pi * 0.55 * t + 0.2)
    breath += 0.04 * np.sin(2 * np.pi * 1.7 * t)
    mix = (rumble + roar + mid + whine) * breath
    return seamless_loop(mix, fade=0.12)


def make_afterburner_loop(seconds: float = 1.8) -> np.ndarray:
    rng = np.random.default_rng(99)
    n = int(seconds * SR)
    rumble = lowpass(brown_noise(n, rng), 140.0) * 1.1
    roar = bandpass(pink_noise(n, rng), 100.0, 900.0) * 0.95
    scream = bandpass(pink_noise(n, rng), 900.0, 4500.0) * 0.55
    crackle = highpass(rng.standard_normal(n), 2500.0)
    crackle = crackle * (rng.random(n) > 0.965).astype(np.float64)
    crackle = lowpass(np.abs(crackle), 8000.0) * 0.35
    t = np.arange(n) / SR
    pulse = 0.9 + 0.1 * np.sin(2 * np.pi * 8.5 * t)
    mix = (rumble + roar + scream + crackle) * pulse
    return seamless_loop(mix, fade=0.1)


def make_missile(duration: float = 0.75) -> np.ndarray:
    rng = np.random.default_rng(7)
    n = int(duration * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 3.2) * (1.0 - np.exp(-t * 40.0))
    noise = pink_noise(n, rng)
    # Rising whoosh: crossfade low -> high bands over time.
    low = bandpass(noise, 200.0, 1400.0)
    high = bandpass(noise, 1400.0, 6500.0)
    rise = np.clip(t / duration, 0.0, 1.0)
    whoosh = low * (1.0 - rise) * 0.55 + high * (0.35 + 0.65 * rise) * 0.9
    # Soft Doppler-ish tone dive after launch.
    freq = 680.0 * np.exp(-t * 1.8) + 180.0
    phase = 2 * np.pi * np.cumsum(freq) / SR
    tone = np.sin(phase) * 0.22 * env
    return (whoosh + tone) * env


def make_boom(duration: float = 1.35) -> np.ndarray:
    rng = np.random.default_rng(21)
    n = int(duration * SR)
    t = np.arange(n) / SR
    # sharp crack
    crack_n = int(0.035 * SR)
    crack = rng.standard_normal(n)
    crack_env = np.zeros(n)
    crack_env[:crack_n] = np.linspace(1.0, 0.0, crack_n)
    crack = highpass(crack, 800.0) * crack_env * 1.2
    # deep boom body
    body_env = np.exp(-t * 3.4)
    body = lowpass(brown_noise(n, rng), 180.0) * body_env * 1.15
    # mid smoke / debris
    mid = bandpass(pink_noise(n, rng), 120.0, 900.0) * np.exp(-t * 5.0) * 0.55
    # sub hit
    sub = np.sin(2 * np.pi * 48.0 * t) * np.exp(-t * 6.0) * 0.7
    sub += np.sin(2 * np.pi * 72.0 * t) * np.exp(-t * 8.0) * 0.25
    return crack + body + mid + sub


def make_roll(duration: float = 0.42) -> np.ndarray:
    rng = np.random.default_rng(55)
    n = int(duration * SR)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(t / duration, 0.0, 1.0)) ** 1.2
    noise = bandpass(pink_noise(n, rng), 250.0, 3500.0)
    air = highpass(pink_noise(n, rng), 1500.0) * 0.35
    freq = 420.0 + 180.0 * np.sin(2 * np.pi * t / duration)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    soft = np.sin(phase) * 0.12
    return (noise * 0.7 + air + soft) * env


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"Generating audio -> {OUT}")
    write_wav(OUT / "engine_loop.wav", make_engine_loop())
    write_wav(OUT / "afterburner_loop.wav", make_afterburner_loop())
    write_wav(OUT / "roll.wav", make_roll())
    # Missile/boom come from Kenney layers via tools/bake_combat_sfx.ps1
    # Keep procedural helpers available if bake pack is unavailable.
    if not (OUT / "missile.wav").exists():
        write_wav(OUT / "missile.wav", make_missile())
    if not (OUT / "boom.wav").exists():
        write_wav(OUT / "boom.wav", make_boom())
    print("done (combat SFX left untouched if already present)")


if __name__ == "__main__":
    main()
