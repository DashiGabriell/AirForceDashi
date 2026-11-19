import type { PerfSnapshot } from "@afd/shared-types";
import type { WebGLRenderer } from "three";

export class PerfMonitor {
  private frames = 0;
  private elapsed = 0;
  private fps = 0;
  private frameMs = 0;
  private last = performance.now();

  beginFrame(now = performance.now()): number {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.frameMs = dt * 1000;
    this.elapsed += dt;
    this.frames += 1;
    if (this.elapsed >= 0.5) {
      this.fps = this.frames / this.elapsed;
      this.frames = 0;
      this.elapsed = 0;
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
    return {
      fps: this.fps,
      frameMs: this.frameMs,
      drawCalls: info.calls,
      triangles: info.triangles,
      jsHeapMb: mem ? mem.usedJSHeapSize / (1024 * 1024) : null,
    };
  }
}
