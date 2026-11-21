import { useEffect, useRef } from "react";
import { createFleetCardPreview } from "@afd/game-render";
import type { Aircraft } from "@afd/shared-types";

interface Props {
  aircraft: Aircraft;
  label: string;
  /** Só monta/renderiza quando o card está na viewport. */
  active: boolean;
}

/** Canvas 3D leve para cards da Frota (renderer compartilhado). */
export function FleetCardThumb({ aircraft, label, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preview = createFleetCardPreview(canvas, aircraft, "factory");
    const io = new IntersectionObserver(
      (entries) => {
        const on = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0.05);
        preview.setVisible(on);
      },
      { threshold: [0, 0.05, 0.2] },
    );
    io.observe(canvas);
    preview.setVisible(true);
    return () => {
      io.disconnect();
      preview.dispose();
    };
  }, [active, aircraft]);

  return (
    <div className="hangar__thumb" aria-hidden>
      <canvas
        ref={canvasRef}
        className="hangar__thumb-canvas"
        aria-label={`Preview ${label}`}
      />
    </div>
  );
}
