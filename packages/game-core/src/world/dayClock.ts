/** ~12+12 min day/night like Godot. */

export class DayClock {
  /** Seconds into cycle. */
  time = 0;
  readonly period = 24 * 60; // 24 min full cycle

  tick(dt: number): void {
    this.time = (this.time + dt) % this.period;
  }

  /** 1 = noon, 0 = midnight. */
  get dayFactor(): number {
    const t = this.time / this.period; // 0..1
    // Peak at 0.25 (morning→noon), trough at 0.75
    const angle = (t - 0.25) * Math.PI * 2;
    return Math.max(0.05, Math.min(1, 0.55 + 0.45 * Math.cos(angle)));
  }

  get sunDir(): { x: number; y: number; z: number } {
    const t = this.time / this.period;
    const elev = (this.dayFactor - 0.05) * 1.2;
    const az = t * Math.PI * 2;
    return {
      x: Math.sin(az) * 0.7,
      y: Math.max(0.08, elev),
      z: Math.cos(az) * 0.7,
    };
  }
}
