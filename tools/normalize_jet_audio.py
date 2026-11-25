"""Make the jet takes stereo, click-free where they loop, and the same loudness.

Loops share -16 dBFS RMS so the afterburner cannot sit 10 dB above the engine.
One-shots share a -6 dBFS peak so a boom is a transient, not a second master.
"""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

SR = 48000
ROOT = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "audio"
LOOPS = {
    "AFD-engine-42.wav",
    "AFD-engine-idle-74.wav",
    "AFD-ab-74.wav",
    "AFD-wind-74.wav",
    "AFD-airbrake-74.wav",
}
SKIP = {"AFD-menu-1.wav", "AFD-fight-1.wav"}
LOOP_RMS_DB = -16.0
SHOT_PEAK_DB = -6.0


def read_mono(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        if w.getsampwidth() != 2:
            raise SystemExit(f"{path.name}: expected 16-bit")
        sr = w.getframerate()
        ch = w.getnchannels()
        raw = w.readframes(w.getnframes())
    pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    if ch > 1:
        pcm = pcm.reshape(-1, ch).mean(axis=1)
    if sr != SR:
        n = int(round(len(pcm) * SR / sr))
        src = np.linspace(0.0, 1.0, len(pcm), endpoint=False)
        dst = np.linspace(0.0, 1.0, n, endpoint=False)
        pcm = np.interp(dst, src, pcm)
    return pcm


def seamless(x: np.ndarray, fade_s: float = 0.08) -> np.ndarray:
    """Blend the tail into the head so the loop point is the same sample."""
    fade = min(int(fade_s * SR), len(x) // 4)
    if fade < 8:
        return x
    ramp = np.linspace(0.0, 1.0, fade)
    out = x.copy()
    out[-fade:] = out[-fade:] * (1.0 - ramp) + out[:fade] * ramp
    return out


def match_rms(x: np.ndarray, db: float) -> np.ndarray:
    rms = float(np.sqrt(np.mean(x * x) + 1e-12))
    target = 10.0 ** (db / 20.0)
    y = x * (target / rms)
    peak = float(np.max(np.abs(y)))
    if peak > 0.89:
        y *= 0.89 / peak
    return y


def match_peak(x: np.ndarray, db: float) -> np.ndarray:
    peak = float(np.max(np.abs(x)) + 1e-12)
    target = 10.0 ** (db / 20.0)
    return x * (target / peak)


def to_stereo(x: np.ndarray) -> np.ndarray:
    delay = int(0.0007 * SR)
    right = np.zeros_like(x)
    if delay < len(x):
        right[delay:] = x[:-delay] * 0.84
    left = x
    return np.column_stack((left, right))


def write_stereo(path: Path, stereo: np.ndarray) -> None:
    pcm = np.clip(stereo, -1.0, 1.0)
    ints = (pcm * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(ints.tobytes())


def main() -> None:
    for path in sorted(ROOT.glob("AFD-*.wav")):
        if path.name in SKIP:
            continue
        mono = read_mono(path)
        if path.name in LOOPS:
            mono = seamless(mono)
            mono = match_rms(mono, LOOP_RMS_DB)
            kind = "loop"
        else:
            mono = match_peak(mono, SHOT_PEAK_DB)
            kind = "shot"
        stereo = to_stereo(mono)
        write_stereo(path, stereo)
        rms = 20.0 * np.log10(np.sqrt(np.mean(stereo[:, 0] ** 2) + 1e-12))
        peak = 20.0 * np.log10(np.max(np.abs(stereo[:, 0])) + 1e-12)
        print(f"  {path.name:28} {kind:4} rms={rms:6.1f} dB peak={peak:5.1f} dB")


if __name__ == "__main__":
    main()
