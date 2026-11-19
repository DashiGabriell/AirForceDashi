import type { PerfSnapshot } from "@afd/shared-types";

interface Props {
  snap: PerfSnapshot | null;
}

export function PerfHud({ snap }: Props) {
  if (!snap) return null;
  const heap =
    snap.jsHeapMb != null ? `${snap.jsHeapMb.toFixed(0)} MB` : "n/a";
  const text = [
    `FPS  ${snap.fps.toFixed(0).padStart(3, " ")}`,
    `ms   ${snap.frameMs.toFixed(1).padStart(4, " ")}`,
    `draw ${String(snap.drawCalls).padStart(3, " ")}`,
    `tris ${snap.triangles}`,
    `heap ${heap}`,
  ].join("\n");
  return <div className="perf">{text}</div>;
}
