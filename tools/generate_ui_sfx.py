#!/usr/bin/env python3
"""Bake UI selection SFX in the same synth language as checkpoint_ok / level_clear.

Stdlib only — matches Air Force Dashi HUD beeps (sine + harmonic, short envelopes).
"""

from __future__ import annotations

import math
import wave
from pathlib import Path

SR = 44100
ROOT = Path(__file__).resolve().parents[1]
OUTS = [
    ROOT / "apps" / "web" / "public" / "audio",
    ROOT / "reestilo" / "audio",
]


def write_wav(path: Path, samples: list[float]) -> None:
    peak = max((abs(s) for s in samples), default=0.0)
    scale = 0.9 / peak if peak > 1e-9 else 1.0
    pcm = bytearray()
    for s in samples:
        v = max(-1.0, min(1.0, s * scale))
        i = int(v * 32767.0)
        pcm += int(i).to_bytes(2, "little", signed=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)
    print(f"  wrote {path}")


def tone(
    duration: float,
    freqs: list[tuple[float, float, float]],
    *,
    attack: float = 0.006,
    release: float = 0.08,
) -> list[float]:
    """freqs: list of (start_t, end_t, hz) segments."""
    n = int(duration * SR)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        hz = freqs[-1][2]
        for start, end, f in freqs:
            if start <= t < end:
                hz = f
                break
        env = 1.0
        if t < attack:
            env = t / attack
        tail = duration - t
        if tail < release:
            env *= max(0.0, tail / release)
        # Same harmonic mix as make_checkpoint_ok
        sample = 0.55 * math.sin(2 * math.pi * hz * t)
        sample += 0.2 * math.sin(2 * math.pi * hz * 2.0 * t)
        out[i] = sample * env
    return out


def make_ui_select() -> list[float]:
    """Chip / tab / hubnav — short single tick near checkpoint family."""
    return tone(0.07, [(0.0, 0.07, 1040.0)], attack=0.003, release=0.045)


def make_ui_confirm() -> list[float]:
    """Primary CTA — two-step like checkpoint_ok, tighter."""
    return tone(
        0.16,
        [(0.0, 0.07, 880.0), (0.07, 0.16, 1320.0)],
        attack=0.005,
        release=0.07,
    )


def make_ui_toggle() -> list[float]:
    """Toggle / range tick — lower, drier."""
    return tone(0.055, [(0.0, 0.055, 720.0)], attack=0.002, release=0.035)


def make_ui_arm() -> list[float]:
    """Section power-on — soft rising chirp, HUD boot."""
    n = int(0.18 * SR)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        hz = 520.0 + 780.0 * (t / 0.18)
        env = min(1.0, t / 0.01) * max(0.0, 1.0 - (t - 0.06) / 0.12)
        sample = 0.42 * math.sin(2 * math.pi * hz * t)
        sample += 0.14 * math.sin(2 * math.pi * hz * 2.0 * t)
        out[i] = sample * env * 0.85
    return out


def make_ui_deny() -> list[float]:
    """Disabled / blocked — descending, same family."""
    return tone(
        0.12,
        [(0.0, 0.05, 420.0), (0.05, 0.12, 280.0)],
        attack=0.004,
        release=0.06,
    )


def main() -> None:
    bank = {
        "ui_select.wav": make_ui_select(),
        "ui_confirm.wav": make_ui_confirm(),
        "ui_toggle.wav": make_ui_toggle(),
        "ui_arm.wav": make_ui_arm(),
        "ui_deny.wav": make_ui_deny(),
    }
    print("Generating AFD UI SFX (checkpoint family)…")
    for out_dir in OUTS:
        for name, samples in bank.items():
            write_wav(out_dir / name, samples)
    print("done")


if __name__ == "__main__":
    main()
