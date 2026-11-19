import { useEffect, useRef } from "react";
import { createBootScene, PerfMonitor } from "@afd/game-render";
import type { PerfSnapshot } from "@afd/shared-types";

interface Props {
  onPerf: (snap: PerfSnapshot) => void;
}

export function BootCanvas({ onPerf }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const boot = createBootScene(canvas);
    const perf = new PerfMonitor();
    let raf = 0;
    let alive = true;

    const resize = () => {
      boot.resize(canvas.clientWidth, canvas.clientHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      if (!alive) return;
      const dt = perf.beginFrame();
      boot.renderer.info.reset();
      boot.render(dt);
      onPerf(perf.snapshot(boot.renderer));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      boot.dispose();
    };
  }, [onPerf]);

  return <canvas ref={canvasRef} className="boot-canvas" aria-hidden />;
}
