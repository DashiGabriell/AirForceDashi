/**
 * In-game clock scale (product rule):
 *   1 game hour  = 1 real minute
 *   24 game hours = 24 real minutes
 */
export const GAME_HOUR_SECONDS = 60;
export const DAY_CYCLE_SECONDS = 24 * GAME_HOUR_SECONDS; // 1440

export type DayPhase =
  | "night"
  | "dawn"
  | "morning"
  | "noon"
  | "afternoon"
  | "dusk";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(edge1 - edge0, 1e-6));
  return t * t * (3 - 2 * t);
}

function wrapHour(h: number): number {
  const x = h % 24;
  return x < 0 ? x + 24 : x;
}

/** Soft bell peaking at `center` with half-width `half`. */
function hourBell(hour: number, center: number, half: number): number {
  let d = Math.abs(hour - center);
  if (d > 12) d = 24 - d;
  return clamp01(1 - d / half);
}

/**
 * Day / night cycle. `time` is real seconds into the 24-minute loop.
 * Default start ≈ 07:30 (clear morning visibility).
 */
export class DayClock {
  /** Seconds into the cycle [0, period). */
  time: number;
  readonly period = DAY_CYCLE_SECONDS;

  constructor(startHour = 7.5) {
    this.time = (wrapHour(startHour) / 24) * this.period;
  }

  tick(dt: number): void {
    if (!Number.isFinite(dt) || dt === 0) return;
    this.time = (this.time + dt) % this.period;
    if (this.time < 0) this.time += this.period;
  }

  /** Set absolute game hour (0..24). */
  setHour(hour: number): void {
    this.time = (wrapHour(hour) / 24) * this.period;
  }

  /** Continuous game hour in [0, 24). */
  get hour(): number {
    return (this.time / this.period) * 24;
  }

  /** Fraction of day in [0, 1), 0 = midnight, 0.5 = noon. */
  get tod(): number {
    return this.time / this.period;
  }

  get phase(): DayPhase {
    const h = this.hour;
    if (h >= 5 && h < 7) return "dawn";
    if (h >= 7 && h < 11) return "morning";
    if (h >= 11 && h < 14) return "noon";
    if (h >= 14 && h < 17) return "afternoon";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }

  get isNight(): boolean {
    return this.dayFactor < 0.35;
  }

  /**
   * Brightness proxy: 1 at noon, ~0 at midnight.
   * Solar elevation = cos((tod - 0.5) · 2π) → +1 noon, −1 midnight, 0 at 06:00/18:00.
   */
  get dayFactor(): number {
    const elev = Math.cos((this.tod - 0.5) * Math.PI * 2);
    return smoothstep(-0.08, 0.55, elev);
  }

  /** Warm sky weight peaking near sunset (~18:00). */
  get duskFactor(): number {
    return hourBell(this.hour, 18.2, 2.4) * (0.45 + 0.55 * this.dayFactor);
  }

  /** Cool/pink weight peaking near sunrise (~06:00). */
  get dawnFactor(): number {
    return hourBell(this.hour, 6.0, 2.0) * (0.35 + 0.65 * this.dayFactor);
  }

  /**
   * Approximate sun direction in world space.
   * Rises east (+X) ~06:00, high south (+Z) at noon, sets west (−X) ~18:00.
   */
  get sunDir(): { x: number; y: number; z: number } {
    const solar = (this.tod - 0.25) * Math.PI * 2; // 0 at 06:00
    const elev = Math.sin(solar);
    const y = elev > 0 ? Math.max(0.08, elev) : 0.04;
    return {
      x: Math.cos(solar) * 0.85,
      y,
      z: Math.sin(solar) * 0.85,
    };
  }
}
