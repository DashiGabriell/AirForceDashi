import type { PerfSnapshot } from "@afd/shared-types";

interface Props {
  snap: PerfSnapshot | null;
}

export function PerfHud({ snap }: Props) {
  if (!snap) return null;
  const heap =
    snap.jsHeapMb != null ? `${snap.jsHeapMb.toFixed(0)} MB` : "n/a";
  const lines = [
    `FPS  ${snap.fps.toFixed(0).padStart(3, " ")}`,
    `ms   ${snap.frameMs.toFixed(1).padStart(4, " ")}`,
    `draw ${String(snap.drawCalls).padStart(3, " ")}`,
    `tris ${snap.triangles}`,
    `heap ${heap}`,
  ];
  if (snap.vfxParticles != null || snap.vfxBooms != null) {
    const p = snap.vfxParticles ?? 0;
    const b = snap.vfxBooms ?? 0;
    const d = snap.vfxDropped ?? 0;
    lines.push(`vfx  p${p} b${b} d${d}`);
  }
  return <div className="perf">{lines.join("\n")}</div>;
}
