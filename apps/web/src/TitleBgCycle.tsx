import { useEffect, useRef, useState } from "react";

const HOLD_MS = 3 * 60 * 1000; // 3 minutos na imagem estática
const GIF_FALLBACK_MS = 8_000;
const FADE_MS = 1600;

const SRC = {
  gif1: "/ui/video-1-title_bg.gif",
  still: "/ui/title_bg.jpg",
  gif2: "/ui/video-2-title_bg.gif",
} as const;

type Phase = "gif1" | "still1" | "gif2" | "still2";

const PHASE_SRC: Record<Phase, string> = {
  gif1: SRC.gif1,
  still1: SRC.still,
  gif2: SRC.gif2,
  still2: SRC.still,
};

const NEXT: Record<Phase, Phase> = {
  gif1: "still1",
  still1: "gif2",
  gif2: "still2",
  still2: "gif1",
};

type Layer = {
  id: number;
  src: string;
  on: boolean;
};

/** Soma delays dos frames de um GIF (centésimos → ms). Fallback se parse falhar. */
async function gifDurationMs(url: string): Promise<number> {
  try {
    const res = await fetch(url);
    if (!res.ok) return GIF_FALLBACK_MS;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 6) return GIF_FALLBACK_MS;
    const header = String.fromCharCode(
      buf[0]!,
      buf[1]!,
      buf[2]!,
      buf[3]!,
      buf[4]!,
      buf[5]!,
    );
    if (!header.startsWith("GIF8")) return GIF_FALLBACK_MS;

    let i = 13;
    const packed = buf[10] ?? 0;
    if (packed & 0x80) {
      const gctSize = 3 * (1 << ((packed & 0x07) + 1));
      i = 13 + gctSize;
    }

    let totalCs = 0;
    let frames = 0;
    while (i < buf.length) {
      const b = buf[i]!;
      if (b === 0x3b) break;
      if (b === 0x21) {
        const label = buf[i + 1];
        if (label === 0xf9 && i + 5 < buf.length) {
          const delay = buf[i + 4]! | (buf[i + 5]! << 8);
          totalCs += delay === 0 ? 10 : delay;
          frames += 1;
          i += 8;
          continue;
        }
        i += 2;
        while (i < buf.length) {
          const sz = buf[i]!;
          i += 1;
          if (sz === 0) break;
          i += sz;
        }
        continue;
      }
      if (b === 0x2c) {
        if (i + 10 >= buf.length) break;
        const localPacked = buf[i + 9]!;
        i += 10;
        if (localPacked & 0x80) {
          i += 3 * (1 << ((localPacked & 0x07) + 1));
        }
        i += 1;
        while (i < buf.length) {
          const sz = buf[i]!;
          i += 1;
          if (sz === 0) break;
          i += sz;
        }
        continue;
      }
      i += 1;
    }

    if (frames === 0 || totalCs <= 0) return GIF_FALLBACK_MS;
    return Math.max(500, totalCs * 10);
  } catch {
    return GIF_FALLBACK_MS;
  }
}

function phaseSrc(phase: Phase, tick: number): string {
  const base = PHASE_SRC[phase];
  if (phase === "gif1" || phase === "gif2") return `${base}?t=${tick}`;
  return base;
}

/**
 * Ciclo do BG de título com crossfade:
 * GIF1 → JPG (3 min) → GIF2 → JPG (3 min) → reinicia.
 */
export function TitleBgCycle() {
  const [phase, setPhase] = useState<Phase>("gif1");
  const [layers, setLayers] = useState<Layer[]>(() => [
    { id: 0, src: SRC.gif1, on: true },
  ]);
  const cache = useRef<Partial<Record<"gif1" | "gif2", number>>>({});
  const idRef = useRef(0);
  const tickRef = useRef(0);
  const phaseRef = useRef<Phase>("gif1");
  phaseRef.current = phase;

  useEffect(() => {
    for (const u of [SRC.still, SRC.gif1, SRC.gif2]) {
      const img = new Image();
      img.src = u;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let pruneTimer: ReturnType<typeof setTimeout> | null = null;

    const crossfadeTo = (next: Phase) => {
      if (cancelled) return;
      if (next === "gif1" || next === "gif2") tickRef.current += 1;
      const src = phaseSrc(next, tickRef.current);
      const id = ++idRef.current;

      setLayers((prev) => {
        const bottom = prev[prev.length - 1];
        const stack: Layer[] = [];
        if (bottom) stack.push({ ...bottom, on: true });
        stack.push({ id, src, on: false });
        return stack;
      });

      // Next paint: trigger opacity transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          setLayers((prev) =>
            prev.map((l) =>
              l.id === id ? { ...l, on: true } : { ...l, on: false },
            ),
          );
        });
      });

      pruneTimer = setTimeout(() => {
        if (cancelled) return;
        setLayers((prev) => {
          const top = prev.find((l) => l.id === id);
          return top ? [{ ...top, on: true }] : prev.slice(-1);
        });
        setPhase(next);
      }, FADE_MS + 40);
    };

    const run = async () => {
      const current = phaseRef.current;
      let wait = HOLD_MS;

      if (current === "gif1" || current === "gif2") {
        const key = current === "gif1" ? "gif1" : "gif2";
        let ms = cache.current[key];
        if (ms == null) {
          ms = await gifDurationMs(PHASE_SRC[current]);
          if (cancelled) return;
          cache.current[key] = ms;
        }
        // Inicia o fade um pouco antes do fim do GIF
        wait = Math.max(400, ms - FADE_MS * 0.35);
      }

      holdTimer = setTimeout(() => {
        if (cancelled) return;
        crossfadeTo(NEXT[phaseRef.current]);
      }, wait);
    };

    void run();

    return () => {
      cancelled = true;
      if (holdTimer != null) clearTimeout(holdTimer);
      if (fadeTimer != null) clearTimeout(fadeTimer);
      if (pruneTimer != null) clearTimeout(pruneTimer);
    };
  }, [phase]);

  return (
    <div className="shell__title-bg-stack" aria-hidden>
      {layers.map((layer) => (
        <img
          key={layer.id}
          className={`shell__title-bg${layer.on ? " shell__title-bg--on" : ""}`}
          src={layer.src}
          alt=""
          draggable={false}
          decoding="async"
        />
      ))}
    </div>
  );
}
