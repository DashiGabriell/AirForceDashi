/**
 * Scales internal render resolution from live frame time without React involvement.
 * Keeps identity of the scene; only changes pixel budget under load.
 */
export class AdaptiveScale {
  /** 0.6..1 multiplier on internal height. */
  scale = 1;
  private acc = 0;
  private dirty = false;

  /**
   * @returns true when the scale changed enough to rebuild the RT.
   */
  tick(dt: number, frameMs: number): boolean {
    this.acc += dt;
    if (this.acc < 0.35) return false;
    this.acc = 0;

    const prev = this.scale;
    if (frameMs > 22) {
      this.scale = Math.max(0.6, this.scale - 0.04);
    } else if (frameMs > 18) {
      this.scale = Math.max(0.7, this.scale - 0.02);
    } else if (frameMs < 14.5) {
      this.scale = Math.min(1, this.scale + 0.015);
    }

    if (Math.abs(this.scale - prev) >= 0.02) {
      this.dirty = true;
      return true;
    }
    return false;
  }

  consumeDirty(): boolean {
    const d = this.dirty;
    this.dirty = false;
    return d;
  }
}
