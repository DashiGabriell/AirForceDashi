import type { PerfSnapshot } from "@afd/shared-types";
import type { WebGLRenderer } from "three";

const SAMPLE_CAP = 90;

export class PerfMonitor {
  private frames = 0;
  private elapsed = 0;
  private fps = 0;
  private frameMs = 0;
  private last = performance.now();
  private readonly samples: number[] = [];
  private fps1Low = 0;

  beginFrame(now = performance.now()): number {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.frameMs = dt * 1000;
    this.elapsed += dt;
    this.frames += 1;

    this.samples.push(this.frameMs);
    if (this.samples.length > SAMPLE_CAP) this.samples.shift();

    if (this.elapsed >= 0.5) {
      this.fps = this.frames / this.elapsed;
      this.frames = 0;
      this.elapsed = 0;
      this.fps1Low = this.compute1Low();
    }
    return dt;
  }

  snapshot(renderer: WebGLRenderer): PerfSnapshot {
    const info = renderer.info.render;
    const mem = (
      performance as Performance & {
        memory?: { usedJSHeapSize: number };
      }
    ).memory;
    const snap: PerfSnapshot = {
      fps: this.fps,
      frameMs: this.frameMs,
      drawCalls: info.calls,
      triangles: info.triangles,
      jsHeapMb: mem ? mem.usedJSHeapSize / (1024 * 1024) : null,
    };
    if (this.fps1Low > 0) snap.fps1Low = this.fps1Low;
    return snap;
  }

  private compute1Low(): number {
    if (this.samples.length < 8) return 0;
    const sorted = [...this.samples].sort((a, b) => b - a);
    const worst = sorted[Math.max(0, Math.floor(sorted.length * 0.01))] ?? sorted[0]!;
    return worst > 0 ? 1000 / worst : 0;
  }
}
