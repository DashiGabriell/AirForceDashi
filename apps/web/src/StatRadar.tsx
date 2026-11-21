export interface StatRadarPoint {
  label: string;
  value: number;
  /** Diff vs previous loadout; + green / − red. Omit or 0 = hidden. */
  delta?: number;
}

interface Props {
  stats: StatRadarPoint[];
  /** Viewbox size; default fits hangar dossier. */
  size?: number;
  className?: string;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(100, n)) / 100;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.sin(angle),
    y: cy - r * Math.cos(angle),
  };
}

function ringPath(cx: number, cy: number, r: number, n: number): string {
  if (n < 3) return "";
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = polar(cx, cy, r, a);
    pts.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

/**
 * Radar tático HUD — polígono vermelho sobre grade escura.
 * Funciona com 3–8 eixos (hexágono ideal com 6).
 */
export function StatRadar({ stats, size = 220, className }: Props) {
  const n = stats.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const labelR = size * 0.46;
  const maxR = size * 0.34;
  const rings = [0.25, 0.5, 0.75, 1];

  const dataPts = stats.map((s, i) => {
    const a = (i / n) * Math.PI * 2;
    return polar(cx, cy, maxR * clamp01(s.value), a);
  });
  const dataPath = `M${dataPts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("L")}Z`;

  return (
    <div className={`stat-radar${className ? ` ${className}` : ""}`}>
      <svg
        className="stat-radar__svg"
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={stats
          .map((s) => {
            const d =
              s.delta && s.delta !== 0 ? ` (${formatDelta(s.delta)})` : "";
            return `${s.label} ${s.value}${d}`;
          })
          .join(", ")}
      >
        <defs>
          <radialGradient id="statRadarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(209,30,36,0.28)" />
            <stop offset="70%" stopColor="rgba(209,30,36,0.08)" />
            <stop offset="100%" stopColor="rgba(209,30,36,0)" />
          </radialGradient>
          <linearGradient id="statRadarFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(242,46,41,0.45)" />
            <stop offset="100%" stopColor="rgba(138,21,25,0.22)" />
          </linearGradient>
        </defs>

        <circle cx={cx} cy={cy} r={maxR * 1.08} fill="url(#statRadarGlow)" />

        {rings.map((t) => (
          <path
            key={t}
            className="stat-radar__ring"
            d={ringPath(cx, cy, maxR * t, n)}
          />
        ))}

        {stats.map((_, i) => {
          const a = (i / n) * Math.PI * 2;
          const tip = polar(cx, cy, maxR, a);
          return (
            <line
              key={`axis-${i}`}
              className="stat-radar__axis"
              x1={cx}
              y1={cy}
              x2={tip.x}
              y2={tip.y}
            />
          );
        })}

        <path className="stat-radar__poly" d={dataPath} fill="url(#statRadarFill)" />
        <path className="stat-radar__poly-stroke" d={dataPath} />

        {dataPts.map((p, i) => (
          <circle
            key={`dot-${i}`}
            className="stat-radar__dot"
            cx={p.x}
            cy={p.y}
            r={2.4}
          />
        ))}

        {stats.map((s, i) => {
          const a = (i / n) * Math.PI * 2;
          const lp = polar(cx, cy, labelR, a);
          const anchor =
            Math.abs(Math.sin(a)) < 0.25
              ? "middle"
              : Math.sin(a) > 0
                ? "start"
                : "end";
          const delta = s.delta ?? 0;
          const showDelta = delta !== 0;
          return (
            <g key={s.label}>
              <text
                className="stat-radar__label"
                x={lp.x}
                y={lp.y}
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {s.label.toUpperCase()}
              </text>
              <text
                className="stat-radar__value"
                x={lp.x}
                y={lp.y + 11}
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {Math.round(s.value)}
                {showDelta ? (
                  <tspan
                    className={
                      delta > 0
                        ? "stat-radar__delta stat-radar__delta--up"
                        : "stat-radar__delta stat-radar__delta--down"
                    }
                    dx="3"
                  >
                    {formatDelta(delta)}
                  </tspan>
                ) : null}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
