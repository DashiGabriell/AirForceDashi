import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  AIRBASE,
  WORLD_SIZE,
  buildPlaces,
  nearestPlace,
  FLARE_MODE_LABEL,
  type FlareMode,
  type PlayerSettings,
  type PlaceOfInterest,
} from "@afd/game-core";
import type { QualityProfile } from "@afd/shared-types";
import { gameAudio, type UiSfxRole } from "./audio/GameAudio";

export interface PauseJetMark {
  x: number;
  z: number;
  /** Heading in degrees (0 = north / −Z). */
  headingDeg: number;
}

export interface NavWaypointMark {
  x: number;
  z: number;
}

interface Props {
  onResume: () => void;
  onMenu: () => void;
  /** Ex.: "CHECKPOINT · Lv 3 · tempo congelado" */
  meta?: string;
  jet?: PauseJetMark | null;
  settings: PlayerSettings;
  onSettingsChange: (partial: Partial<PlayerSettings>) => void;
  /** Nav pin set from expanded tacmap (RMB). */
  navWaypoint?: NavWaypointMark | null;
  onNavWaypointChange?: (wp: NavWaypointMark | null) => void;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.35;
const WORLD_KM = WORLD_SIZE / 1000;
/** Visual ocean skirt (must match `--map-ocean-pad` in CSS). */
const OCEAN_PAD_INLINE = 0.22;
const OCEAN_PAD_EXPANDED = 0.48;
/** Virtual pan room (can exceed visual ocean — dark frame shows through). */
const PAN_PAD_INLINE = 0.55;
const PAN_PAD_EXPANDED = 1.35;
/** Extra pan slack beyond the virtual pad (fraction of frame). */
const PAN_EDGE_SLACK = 0.45;
/** Cursor→pan gain (expanded feels snappier). */
const PAN_GAIN_INLINE = 1.15;
const PAN_GAIN_EXPANDED = 1.45;

function punch(el: HTMLElement): void {
  el.classList.remove("is-punch");
  void el.offsetWidth;
  el.classList.add("is-punch");
}

function worldToMapPct(x: number, z: number): { left: number; top: number } {
  const half = WORLD_SIZE * 0.5;
  const u = (x + half) / WORLD_SIZE;
  const v = (z + half) / WORLD_SIZE;
  return {
    left: Math.min(100, Math.max(0, u * 100)),
    top: Math.min(100, Math.max(0, v * 100)),
  };
}

function formatCoord(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(0)} m`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Square content (islands map) side in CSS px before zoom. */
function contentSide(
  frame: { clientWidth: number; clientHeight: number },
  expanded: boolean,
): number {
  return expanded
    ? Math.max(frame.clientWidth, frame.clientHeight)
    : frame.clientWidth;
}

/** Virtual layer side used for pan limits (larger than visual ocean). */
function layerSide(
  frame: { clientWidth: number; clientHeight: number },
  expanded: boolean,
): number {
  const pad = expanded ? PAN_PAD_EXPANDED : PAN_PAD_INLINE;
  return contentSide(frame, expanded) * (1 + 2 * pad);
}

function panLimits(
  zoom: number,
  frameW: number,
  frameH: number,
  layerPx: number,
): { limitX: number; limitY: number } {
  if (layerPx <= 0 || frameW <= 0 || frameH <= 0) {
    return { limitX: 0, limitY: 0 };
  }
  const halfScaled = layerPx * zoom * 0.5;
  const slackX = frameW * PAN_EDGE_SLACK;
  const slackY = frameH * PAN_EDGE_SLACK;
  return {
    limitX: Math.max(0, halfScaled - frameW * 0.5) + slackX,
    limitY: Math.max(0, halfScaled - frameH * 0.5) + slackY,
  };
}

function clampPan(
  panX: number,
  panY: number,
  zoom: number,
  frameW: number,
  frameH: number,
  layerPx: number,
): { x: number; y: number } {
  const { limitX, limitY } = panLimits(zoom, frameW, frameH, layerPx);
  return {
    x: clamp(panX, -limitX, limitX),
    y: clamp(panY, -limitY, limitY),
  };
}

function layerTransform(
  expanded: boolean,
  pan: { x: number; y: number },
  zoom: number,
): string {
  // translate3d keeps the layer on the GPU compositor (no paint thrash).
  return expanded
    ? `translate3d(-50%, -50%, 0) translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`
    : `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`;
}

function headingNorm(deg: number): number {
  return Math.floor(((deg % 360) + 360) % 360);
}

function screenToWorldOnMap(
  frame: HTMLDivElement,
  clientX: number,
  clientY: number,
  zoom: number,
  pan: { x: number; y: number },
  expanded: boolean,
): NavWaypointMark {
  const rect = frame.getBoundingClientRect();
  const cSide = contentSide(
    { clientWidth: rect.width, clientHeight: rect.height },
    expanded,
  );
  const mx = clientX - rect.left - rect.width * 0.5;
  const my = clientY - rect.top - rect.height * 0.5;
  const lx = (mx - pan.x) / zoom;
  const ly = (my - pan.y) / zoom;
  const u = clamp(0.5 + lx / cSide, 0, 1);
  const v = clamp(0.5 + ly / cSide, 0, 1);
  const half = WORLD_SIZE * 0.5;
  return {
    x: u * WORLD_SIZE - half,
    z: v * WORLD_SIZE - half,
  };
}

const HALF = WORLD_SIZE * 0.5;

/** Runway, taxi and aprons in world metres, drawn over the bitmap. */
function ChartOverlay() {
  const ax = AIRBASE.x;
  const az = AIRBASE.z;
  const rw = AIRBASE.runwayLength;
  const rh = AIRBASE.runwayWidth;
  const taxiZ = az + AIRBASE.taxiOffset;
  return (
    <svg
      className="pause-map__chart"
      viewBox={`${-HALF} ${-HALF} ${WORLD_SIZE} ${WORLD_SIZE}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x={ax - 450}
        y={taxiZ + 40}
        width={900}
        height={220}
        className="pause-map__apron"
      />
      <rect
        x={ax + 260}
        y={taxiZ + 20}
        width={520}
        height={180}
        className="pause-map__apron"
      />
      <rect
        x={ax - rw * 0.5}
        y={az - rh * 0.5}
        width={rw}
        height={rh}
        className="pause-map__runway"
      />
      <line
        x1={ax - rw * 0.46}
        y1={az}
        x2={ax + rw * 0.46}
        y2={az}
        className="pause-map__centerline"
      />
      <rect
        x={ax - (rw - 200) * 0.5}
        y={taxiZ - AIRBASE.taxiWidth * 0.5}
        width={rw - 200}
        height={AIRBASE.taxiWidth}
        className="pause-map__taxi"
      />
    </svg>
  );
}

function GridTicks({ zoom }: { zoom: number }) {
  const ticks = [-6, -4, -2, 0, 2, 4, 6];
  return (
    <div className="pause-map__ticks" aria-hidden>
      {ticks.map((km) => {
        const pct = ((km * 1000 + HALF) / WORLD_SIZE) * 100;
        return (
          <span
            key={km}
            className="pause-map__tick"
            style={{
              left: `${pct}%`,
              transform: `translate(-50%, 0) scale(${1 / zoom})`,
            }}
          >
            {km > 0 ? `+${km}` : km}
          </span>
        );
      })}
    </div>
  );
}

function RangeRing({
  km,
  left,
  top,
  zoom,
}: {
  km: number;
  left: number;
  top: number;
  zoom: number;
}) {
  const pct = ((km * 1000) / WORLD_SIZE) * 100;
  return (
    <span
      className="pause-map__ring"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${pct}%`,
        height: `${pct}%`,
      }}
    >
      <span
        className="pause-map__ring-label"
        style={{ transform: `translate(-50%, -130%) scale(${1 / zoom})` }}
      >
        {km} km
      </span>
    </span>
  );
}

function ScaleBar({
  frameRef,
  zoom,
  expanded,
}: {
  frameRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  expanded: boolean;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frameRef, expanded]);

  const side = expanded ? Math.max(box.w, box.h) : box.w;
  if (side <= 0) return null;
  const mPerPx = WORLD_SIZE / (side * zoom);
  const steps = [500, 1000, 2000, 5000];
  const barM = steps.reduce((best, m) =>
    Math.abs(m / mPerPx - 96) < Math.abs(best / mPerPx - 96) ? m : best,
  );
  const barPx = Math.max(36, barM / mPerPx);
  const label = barM >= 1000 ? `${barM / 1000} km` : `${barM} m`;
  return (
    <div className="pause-map__scale" aria-hidden>
      <span className="pause-map__scale-bar" style={{ width: barPx }} />
      <span className="pause-map__scale-label">{label}</span>
    </div>
  );
}

interface TacMapProps {
  expanded: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
  layerRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  places: PlaceOfInterest[];
  jet: PauseJetMark | null | undefined;
  jetPct: { left: number; top: number } | null;
  hoverPoi: string | null;
  setHoverPoi: Dispatch<SetStateAction<string | null>>;
  nearName: string | null;
  visibleKm: number;
  onDoubleClick: (ev: React.MouseEvent<HTMLDivElement>) => void;
  bumpZoom: (dir: 1 | -1) => void;
  focusJet: (z?: number) => void;
  resetView: () => void;
  onToggleExpand: () => void;
  navWaypoint?: NavWaypointMark | null;
  onMarkNav?: (clientX: number, clientY: number) => void;
  onClearNav?: () => void;
  toolbarExtra?: ReactNode;
}

function TacMap({
  expanded,
  frameRef,
  layerRef,
  zoom,
  pan,
  places,
  jet,
  jetPct,
  hoverPoi,
  setHoverPoi,
  nearName,
  visibleKm,
  onDoubleClick,
  bumpZoom,
  focusJet,
  resetView,
  onToggleExpand,
  navWaypoint = null,
  onMarkNav,
  onClearNav,
  toolbarExtra,
}: TacMapProps) {
  const showPoiLabels = zoom >= 1.8 || expanded;
  const navPct = navWaypoint
    ? worldToMapPct(navWaypoint.x, navWaypoint.z)
    : null;

  return (
    <section
      className={`pause-map${expanded ? " pause-map--expanded" : ""}`}
      aria-label={expanded ? "Mapa tático expandido" : "Mapa tático"}
    >
      <header className="pause-map__head">
        <div className="pause-map__head-main">
          <span className="pause-map__kicker">
            {expanded ? "TACMAP · EXPANDIDO" : "TACMAP"}
          </span>
          <span className="pause-map__title">Pacific Islands</span>
        </div>
        <div className="pause-map__head-meta">
          <span className="pause-map__chip">
            {visibleKm.toFixed(1)} km vista
          </span>
          <span className="pause-map__chip pause-map__chip--zoom">
            ×{zoom.toFixed(1)}
          </span>
          <button
            type="button"
            className="pause-map__chip pause-map__chip--btn"
            data-sfx="select"
            aria-pressed={expanded}
            aria-label={expanded ? "Recolher mapa" : "Expandir mapa 4×"}
            onClick={onToggleExpand}
          >
            {expanded ? "RECOLHER" : "EXPANDIR 4×"}
          </button>
          {toolbarExtra}
        </div>
      </header>

      <div
        ref={frameRef}
        className={`pause-map__frame${
          zoom > 1.01 || expanded ? " is-zoomed" : ""
        }${expanded ? " pause-map__frame--expanded" : ""}`}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => {
          if (!expanded || !onMarkNav) return;
          e.preventDefault();
          onMarkNav(e.clientX, e.clientY);
        }}
      >
        <div ref={layerRef} className="pause-map__layer">
          <div className="pause-map__content">
            <img
              className="pause-map__img"
              src="/maps/pacific_islands/map.png?v=3"
              alt="Mapa Pacific Islands"
              decoding="async"
              draggable={false}
            />
            <ChartOverlay />
            {expanded ? <GridTicks zoom={zoom} /> : null}
            {jetPct ? (
              <>
                <RangeRing km={5} left={jetPct.left} top={jetPct.top} zoom={zoom} />
                {expanded || zoom >= 2 ? (
                  <RangeRing km={10} left={jetPct.left} top={jetPct.top} zoom={zoom} />
                ) : null}
              </>
            ) : null}
            <div className="pause-map__grid" aria-hidden />
            {places.map((p) => {
              const pct = worldToMapPct(p.x, p.z);
              const kind = p.kind.toLowerCase();
              return (
                <button
                  key={p.name}
                  type="button"
                  className={`pause-map__poi pause-map__poi--${kind}${
                    hoverPoi === p.name ? " is-hot" : ""
                  }`}
                  style={{
                    left: `${pct.left}%`,
                    top: `${pct.top}%`,
                    transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                  }}
                  title={p.name}
                  aria-label={p.name}
                  onMouseEnter={() => setHoverPoi(p.name)}
                  onMouseLeave={() => setHoverPoi(null)}
                  onFocus={() => setHoverPoi(p.name)}
                  onBlur={() => setHoverPoi(null)}
                >
                  {showPoiLabels || hoverPoi === p.name ? (
                    <span className="pause-map__poi-label">{p.name}</span>
                  ) : null}
                </button>
              );
            })}
            {navPct ? (
              <span
                className="pause-map__nav"
                style={{
                  left: `${navPct.left}%`,
                  top: `${navPct.top}%`,
                  transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                }}
                title="Waypoint NAV"
              />
            ) : null}
            {jetPct ? (
              <span
                className="pause-map__jet"
                style={{
                  left: `${jetPct.left}%`,
                  top: `${jetPct.top}%`,
                  transform: `translate(-50%, -50%) rotate(${
                    jet?.headingDeg ?? 0
                  }deg) scale(${1 / zoom})`,
                }}
                title="Sua posição"
              >
                <span className="pause-map__jet-ring" aria-hidden />
                <span className="pause-map__jet-nose" aria-hidden />
              </span>
            ) : null}
          </div>
        </div>

        <div className="pause-map__compass" aria-hidden>
          <span className="pause-map__rose-n">N</span>
          {expanded ? (
            <>
              <span className="pause-map__rose-e">E</span>
              <span className="pause-map__rose-s">S</span>
              <span className="pause-map__rose-w">W</span>
            </>
          ) : null}
        </div>
        <ScaleBar
          frameRef={frameRef}
          zoom={zoom}
          expanded={expanded}
        />

        <div
          className="pause-map__zoom"
          role="group"
          aria-label="Zoom do mapa"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="pause-map__zbtn"
            data-sfx="select"
            aria-label="Aproximar"
            disabled={zoom >= ZOOM_MAX - 0.01}
            onClick={() => bumpZoom(1)}
          >
            +
          </button>
          <button
            type="button"
            className="pause-map__zbtn"
            data-sfx="select"
            aria-label="Afastar"
            disabled={zoom <= ZOOM_MIN + 0.01}
            onClick={() => bumpZoom(-1)}
          >
            −
          </button>
          <button
            type="button"
            className="pause-map__zbtn pause-map__zbtn--wide"
            data-sfx="select"
            aria-label="Recentrar no jato"
            disabled={!jet}
            onClick={() => focusJet(2.6)}
          >
            JET
          </button>
          <button
            type="button"
            className="pause-map__zbtn pause-map__zbtn--wide"
            data-sfx="select"
            aria-label="Resetar zoom"
            disabled={zoom <= 1.01 && Math.abs(pan.x) < 1 && Math.abs(pan.y) < 1}
            onClick={resetView}
          >
            FIT
          </button>
          <button
            type="button"
            className={`pause-map__zbtn pause-map__zbtn--wide${
              expanded ? " is-on" : ""
            }`}
            data-sfx="select"
            aria-label={expanded ? "Recolher mapa" : "Expandir mapa 4×"}
            aria-pressed={expanded}
            onClick={onToggleExpand}
          >
            {expanded ? "−4×" : "+4×"}
          </button>
          {navWaypoint && onClearNav ? (
            <button
              type="button"
              className="pause-map__zbtn pause-map__zbtn--wide pause-map__zbtn--nav"
              data-sfx="deny"
              aria-label="Limpar waypoint"
              onClick={onClearNav}
            >
              CLR
            </button>
          ) : null}
        </div>

        <div className="pause-map__hint" aria-hidden>
          {expanded
            ? "arraste o oceano · scroll · RMB = NAV · Esc recolhe"
            : "scroll · arraste · expandir 4× · duplo-clique"}
        </div>
      </div>

      <div className="pause-map__legend" aria-hidden>
        <span className="pause-map__leg pause-map__leg--jet">Você</span>
        <span className="pause-map__leg pause-map__leg--nav">NAV</span>
        <span className="pause-map__leg pause-map__leg--airport">Base</span>
        <span className="pause-map__leg pause-map__leg--city">POI</span>
        <span className="pause-map__leg pause-map__leg--suburb">Setor</span>
      </div>

      <footer className="pause-map__footer">
        {jet ? (
          <>
            <span className="pause-map__readout">
              <em>POS</em> {formatCoord(jet.x)} · {formatCoord(jet.z)}
            </span>
            <span className="pause-map__readout">
              <em>HDG</em> {headingNorm(jet.headingDeg)}°
            </span>
            <span className="pause-map__readout pause-map__readout--place">
              <em>NEAR</em> {hoverPoi ?? nearName ?? "—"}
            </span>
            {navWaypoint ? (
              <span className="pause-map__readout pause-map__readout--nav">
                <em>NAV</em> {formatCoord(navWaypoint.x)} ·{" "}
                {formatCoord(navWaypoint.z)}
              </span>
            ) : null}
          </>
        ) : (
          <span>Posição indisponível</span>
        )}
      </footer>
    </section>
  );
}

export const PauseMenu = memo(function PauseMenu({
  onResume,
  onMenu,
  meta,
  jet,
  settings,
  onSettingsChange,
  navWaypoint = null,
  onNavWaypointChange,
}: Props) {
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoverPoi, setHoverPoi] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const expandedRef = useRef(mapExpanded);
  const draggingRef = useRef(false);
  const sizeBeforeToggleRef = useRef(0);
  const rafPaintRef = useRef(0);
  expandedRef.current = mapExpanded;
  // Never clobber live drag pan with stale React state.
  if (!draggingRef.current) {
    zoomRef.current = zoom;
    panRef.current = pan;
  }

  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    limitX: number;
    limitY: number;
    gain: number;
  } | null>(null);

  const places = useMemo(() => buildPlaces(), []);
  const jetPct = jet ? worldToMapPct(jet.x, jet.z) : null;
  const near = jet ? nearestPlace(jet.x, jet.z, places, 4500) : null;
  const visibleKm = WORLD_KM / zoom;

  const paintLayer = useCallback(
    (nextPan: { x: number; y: number }, nextZoom: number) => {
      const layer = layerRef.current;
      if (!layer) return;
      layer.style.transform = layerTransform(
        expandedRef.current,
        nextPan,
        nextZoom,
      );
    },
    [],
  );

  const schedulePaint = useCallback(() => {
    if (rafPaintRef.current) return;
    rafPaintRef.current = requestAnimationFrame(() => {
      rafPaintRef.current = 0;
      paintLayer(panRef.current, zoomRef.current);
    });
  }, [paintLayer]);

  // Transform is painted imperatively so drag never fights React style diffs.
  useLayoutEffect(() => {
    if (draggingRef.current) return;
    paintLayer(pan, zoom);
  }, [pan, zoom, mapExpanded, paintLayer]);

  const applyView = useCallback(
    (
      nextZoom: number,
      nextPan: { x: number; y: number },
      opts?: { commit?: boolean; paint?: boolean },
    ) => {
      const frame = frameRef.current;
      const expanded = expandedRef.current;
      const z = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
      const p = frame
        ? clampPan(
            nextPan.x,
            nextPan.y,
            z,
            frame.clientWidth,
            frame.clientHeight,
            layerSide(frame, expanded),
          )
        : { x: 0, y: 0 };
      zoomRef.current = z;
      panRef.current = p;
      if (opts?.paint !== false) paintLayer(p, z);
      if (opts?.commit !== false) {
        setZoom((prev) => (prev === z ? prev : z));
        setPan((prev) =>
          prev.x === p.x && prev.y === p.y ? prev : p,
        );
      }
      return p;
    },
    [paintLayer],
  );

  const focusJet = useCallback(
    (nextZoom = Math.max(zoomRef.current, 2.4)) => {
      const frame = frameRef.current;
      if (!frame || !jetPct) {
        applyView(nextZoom, { x: 0, y: 0 });
        return;
      }
      const size = contentSide(frame, expandedRef.current);
      const z = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
      const ox = ((jetPct.left - 50) / 100) * size;
      const oy = ((jetPct.top - 50) / 100) * size;
      applyView(z, { x: -ox * z, y: -oy * z });
    },
    [applyView, jetPct],
  );

  const resetView = useCallback(() => {
    applyView(1, { x: 0, y: 0 });
  }, [applyView]);

  const bumpZoom = useCallback(
    (dir: 1 | -1) => {
      const prev = zoomRef.current;
      const next = clamp(prev + dir * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);
      if (next === prev) return;
      if (jetPct && next > prev) {
        focusJet(next);
        return;
      }
      const scale = next / prev;
      applyView(next, {
        x: panRef.current.x * scale,
        y: panRef.current.y * scale,
      });
    },
    [applyView, focusJet, jetPct],
  );

  const toggleExpand = useCallback(() => {
    sizeBeforeToggleRef.current = frameRef.current
      ? layerSide(frameRef.current, expandedRef.current)
      : 0;
    setMapExpanded((v) => !v);
  }, []);

  useEffect(() => {
    const prev = sizeBeforeToggleRef.current;
    const id = requestAnimationFrame(() => {
      const frame = frameRef.current;
      const next = frame ? layerSide(frame, mapExpanded) : 0;
      if (prev > 0 && next > 0 && Math.abs(next - prev) > 2) {
        const r = next / prev;
        applyView(zoomRef.current, {
          x: panRef.current.x * r,
          y: panRef.current.y * r,
        });
      } else {
        applyView(zoomRef.current, panRef.current);
      }
      sizeBeforeToggleRef.current = next;
    });
    return () => cancelAnimationFrame(id);
  }, [mapExpanded, applyView]);

  // Native pan/zoom listeners — zero React work while dragging.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const t = ev.target as Element | null;
      if (t?.closest?.(".pause-map__zoom, .pause-map__zbtn, .pause-map__poi")) {
        return;
      }
      const expanded = expandedRef.current;
      const z = zoomRef.current;
      const { limitX, limitY } = panLimits(
        z,
        frame.clientWidth,
        frame.clientHeight,
        layerSide(frame, expanded),
      );
      draggingRef.current = true;
      frame.classList.add("is-dragging");
      frame.setPointerCapture(ev.pointerId);
      dragRef.current = {
        pointerId: ev.pointerId,
        lastX: ev.clientX,
        lastY: ev.clientY,
        limitX,
        limitY,
        gain: expanded ? PAN_GAIN_EXPANDED : PAN_GAIN_INLINE,
      };
    };

    const onPointerMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      const dx = (ev.clientX - drag.lastX) * drag.gain;
      const dy = (ev.clientY - drag.lastY) * drag.gain;
      drag.lastX = ev.clientX;
      drag.lastY = ev.clientY;
      panRef.current = {
        x: clamp(panRef.current.x + dx, -drag.limitX, drag.limitX),
        y: clamp(panRef.current.y + dy, -drag.limitY, drag.limitY),
      };
      schedulePaint();
    };

    const endDrag = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      dragRef.current = null;
      draggingRef.current = false;
      frame.classList.remove("is-dragging");
      if (rafPaintRef.current) {
        cancelAnimationFrame(rafPaintRef.current);
        rafPaintRef.current = 0;
      }
      paintLayer(panRef.current, zoomRef.current);
      setPan({ ...panRef.current });
      setZoom(zoomRef.current);
      try {
        frame.releasePointerCapture(ev.pointerId);
      } catch {
        /* already released */
      }
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = frame.getBoundingClientRect();
      const mx = ev.clientX - rect.left - rect.width / 2;
      const my = ev.clientY - rect.top - rect.height / 2;
      const prev = zoomRef.current;
      const factor = ev.deltaY < 0 ? 1.14 : 1 / 1.14;
      const next = clamp(prev * factor, ZOOM_MIN, ZOOM_MAX);
      if (Math.abs(next - prev) < 0.001) return;
      const wx = (mx - panRef.current.x) / prev;
      const wy = (my - panRef.current.y) / prev;
      applyView(next, {
        x: mx - wx * next,
        y: my - wy * next,
      });
    };

    frame.addEventListener("pointerdown", onPointerDown);
    frame.addEventListener("pointermove", onPointerMove);
    frame.addEventListener("pointerup", endDrag);
    frame.addEventListener("pointercancel", endDrag);
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      frame.removeEventListener("pointerdown", onPointerDown);
      frame.removeEventListener("pointermove", onPointerMove);
      frame.removeEventListener("pointerup", endDrag);
      frame.removeEventListener("pointercancel", endDrag);
      frame.removeEventListener("wheel", onWheel);
      if (rafPaintRef.current) {
        cancelAnimationFrame(rafPaintRef.current);
        rafPaintRef.current = 0;
      }
    };
  }, [applyView, mapExpanded, paintLayer, schedulePaint]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onPointerDownSfx = (ev: PointerEvent) => {
      const target = (ev.target as Element | null)?.closest?.(
        "[data-sfx]",
      ) as HTMLElement | null;
      if (!target || !root.contains(target)) return;

      const isToggle = target.hasAttribute("data-audio-toggle");
      let role = (target.getAttribute("data-sfx") || "select") as UiSfxRole;
      if (
        (target as HTMLButtonElement).disabled ||
        target.getAttribute("aria-disabled") === "true"
      ) {
        role = "deny";
      }

      void (async () => {
        if (isToggle) {
          await gameAudio.toggleUi();
          return;
        }
        await gameAudio.armUi();
        gameAudio.playUi(role);
        punch(target);
      })();
    };

    const onPointerEnter = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") return;
      const target = (ev.target as Element | null)?.closest?.(
        "button[data-sfx]",
      ) as HTMLElement | null;
      if (!target || !root.contains(target)) return;
      if (target.hasAttribute("data-audio-toggle")) return;
      void gameAudio.armUi().then(() => gameAudio.playUi("select"));
    };

    root.addEventListener("pointerdown", onPointerDownSfx);
    root.addEventListener("pointerenter", onPointerEnter, true);
    return () => {
      root.removeEventListener("pointerdown", onPointerDownSfx);
      root.removeEventListener("pointerenter", onPointerEnter, true);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        if (configOpen) {
          e.preventDefault();
          setConfigOpen(false);
          return;
        }
        if (abandonOpen) {
          e.preventDefault();
          setAbandonOpen(false);
          return;
        }
        if (mapExpanded) {
          e.preventDefault();
          sizeBeforeToggleRef.current = frameRef.current
            ? layerSide(frameRef.current, true)
            : 0;
          setMapExpanded(false);
          return;
        }
        return;
      }
      if (configOpen || abandonOpen) return;
      if (e.code === "Equal" || e.code === "NumpadAdd") {
        e.preventDefault();
        bumpZoom(1);
      } else if (e.code === "Minus" || e.code === "NumpadSubtract") {
        e.preventDefault();
        bumpZoom(-1);
      } else if (e.code === "Digit0" || e.code === "Numpad0") {
        e.preventDefault();
        resetView();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleExpand();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abandonOpen, bumpZoom, configOpen, mapExpanded, resetView, toggleExpand]);

  const masterPct = Math.round(settings.masterVolume * 100);
  const fightMusicPct = Math.round(settings.fightMusicVolume * 100);
  const sfxPct = Math.round(settings.sfxVolume * 100);
  const sensPct = Math.round(settings.mouseSens * 100);

  const patch = (partial: Partial<PlayerSettings>) => {
    onSettingsChange(partial);
    const next = { ...settings, ...partial };
    if (
      partial.masterVolume != null ||
      partial.sfxVolume != null ||
      partial.musicVolume != null ||
      partial.fightMusicEnabled != null ||
      partial.fightMusicVolume != null
    ) {
      gameAudio.applyPlayerSettings({
        masterVolume: next.masterVolume,
        sfxVolume: next.sfxVolume,
        musicVolume: next.musicVolume,
        fightMusicEnabled: next.fightMusicEnabled,
        fightMusicVolume: next.fightMusicVolume,
      });
      void gameAudio.unlock();
    }
  };

  const markNavAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!onNavWaypointChange || !frameRef.current) return;
      const wp = screenToWorldOnMap(
        frameRef.current,
        clientX,
        clientY,
        zoomRef.current,
        panRef.current,
        expandedRef.current,
      );
      onNavWaypointChange(wp);
      void gameAudio.armUi().then(() => gameAudio.playUi("confirm"));
    },
    [onNavWaypointChange],
  );

  const clearNav = useCallback(() => {
    onNavWaypointChange?.(null);
  }, [onNavWaypointChange]);

  const tacMapProps: Omit<TacMapProps, "expanded" | "toolbarExtra"> = {
    frameRef,
    layerRef,
    zoom,
    pan,
    places,
    jet,
    jetPct,
    hoverPoi,
    setHoverPoi,
    nearName: near?.name ?? null,
    visibleKm,
    onDoubleClick: (e) => {
      e.preventDefault();
      if (zoom > 1.05) resetView();
      else focusJet(2.6);
    },
    bumpZoom,
    focusJet,
    resetView,
    onToggleExpand: toggleExpand,
    navWaypoint,
    ...(onNavWaypointChange
      ? { onMarkNav: markNavAt, onClearNav: clearNav }
      : {}),
  };

  return (
    <div ref={rootRef} className="pause-root">
      {!mapExpanded ? (
        <div className="game-overlay game-overlay--pause" id="pause-overlay">
          <div className="game-overlay__bg" aria-hidden="true">
            <img
              className="game-overlay__bg-img"
              src="/ui/title_bg.jpg"
              alt=""
              decoding="async"
            />
            <div className="game-overlay__veil" />
          </div>

          <div className="overlay-card pause pause--with-map">
            <div className="pause__layout">
              <TacMap {...tacMapProps} expanded={false} />

              <div className="pause__side">
                <p className="pause__status">
                  <span className="pause__status-dot" aria-hidden />
                  Sistema em espera
                </p>
                <h3 className="pause__title">PAUSA</h3>
                <div className="pause__accent" />
                {meta ? <p className="pause__meta">{meta}</p> : null}
                <p className="pause__side-copy">
                  Tempo congelado. Expanda o tacmap (F / 4×) para navegar com
                  mais liberdade.
                </p>
                <div className="pause__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    data-sfx="confirm"
                    onClick={onResume}
                  >
                    Retomar
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    data-sfx="select"
                    onClick={toggleExpand}
                  >
                    Expandir mapa
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    data-sfx="toggle"
                    data-audio-toggle
                  >
                    Som
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    data-sfx="select"
                    onClick={() => setConfigOpen(true)}
                  >
                    Config
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    data-sfx="deny"
                    onClick={() => setAbandonOpen(true)}
                  >
                    Abandonar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="game-overlay game-overlay--pause game-overlay--map-expand"
          id="pause-map-expand"
        >
          <div className="game-overlay__bg" aria-hidden="true">
            <img
              className="game-overlay__bg-img"
              src="/ui/title_bg.jpg"
              alt=""
              decoding="async"
            />
            <div className="game-overlay__veil game-overlay__veil--map" />
          </div>

          <div className="pause-map-expand-shell">
            <TacMap
              {...tacMapProps}
              expanded
              toolbarExtra={
                <>
                  <button
                    type="button"
                    className="btn btn--ghost pause-map__head-btn"
                    data-sfx="select"
                    onClick={toggleExpand}
                  >
                    Recolher
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary pause-map__head-btn"
                    data-sfx="confirm"
                    onClick={onResume}
                  >
                    Retomar
                  </button>
                </>
              }
            />
          </div>
        </div>
      )}

      {configOpen ? (
        <div className="game-overlay game-overlay--pause" id="config-overlay">
          <div className="game-overlay__bg" aria-hidden="true">
            <img
              className="game-overlay__bg-img"
              src="/ui/title_bg.jpg"
              alt=""
              decoding="async"
            />
            <div className="game-overlay__veil" />
          </div>
          <div className="overlay-card pause-cfg">
            <h3 className="pause__title">CONFIG</h3>
            <div className="pause__accent" />
            <p className="pause__meta">Ajustes de voo — áudio, mira e qualidade</p>

            <div className="pause-cfg__rows">
              <label className="pause-cfg__row">
                <span className="pause-cfg__label">
                  Volume master
                  <span className="pause-cfg__hint">Saída geral</span>
                </span>
                <span className="pause-cfg__control">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={masterPct}
                    onChange={(e) =>
                      patch({ masterVolume: Number(e.target.value) / 100 })
                    }
                  />
                  <span className="pause-cfg__val">{masterPct}</span>
                </span>
              </label>

              <label className="pause-cfg__row">
                <span className="pause-cfg__label">
                  Volume SFX
                  <span className="pause-cfg__hint">Motor · armas · UI</span>
                </span>
                <span className="pause-cfg__control">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={sfxPct}
                    onChange={(e) =>
                      patch({ sfxVolume: Number(e.target.value) / 100 })
                    }
                  />
                  <span className="pause-cfg__val">{sfxPct}</span>
                </span>
              </label>

              <label className="pause-cfg__row">
                <span className="pause-cfg__label">
                  Música de combate
                  <span className="pause-cfg__hint">ON/OFF durante a play</span>
                </span>
                <span className="pause-cfg__control">
                  <button
                    type="button"
                    className={`chip${settings.fightMusicEnabled ? " chip--on" : ""}`}
                    data-sfx="toggle"
                    onClick={() =>
                      patch({ fightMusicEnabled: !settings.fightMusicEnabled })
                    }
                  >
                    {settings.fightMusicEnabled ? "ON" : "OFF"}
                  </button>
                </span>
              </label>

              <label className="pause-cfg__row">
                <span className="pause-cfg__label">
                  Volume combate
                  <span className="pause-cfg__hint">Fight theme loop</span>
                </span>
                <span className="pause-cfg__control">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fightMusicPct}
                    disabled={!settings.fightMusicEnabled}
                    onChange={(e) =>
                      patch({ fightMusicVolume: Number(e.target.value) / 100 })
                    }
                  />
                  <span className="pause-cfg__val">{fightMusicPct}</span>
                </span>
              </label>

              <label className="pause-cfg__row">
                <span className="pause-cfg__label">
                  Sensibilidade
                  <span className="pause-cfg__hint">Mouse look · free cam</span>
                </span>
                <span className="pause-cfg__control">
                  <input
                    type="range"
                    min={35}
                    max={200}
                    value={sensPct}
                    onChange={(e) =>
                      patch({ mouseSens: Number(e.target.value) / 100 })
                    }
                  />
                  <span className="pause-cfg__val">{sensPct}</span>
                </span>
              </label>

              <div className="pause-cfg__row">
                <span className="pause-cfg__label">
                  Qualidade
                  <span className="pause-cfg__hint">
                    Resolução interna · aplica no próximo voo
                  </span>
                </span>
                <div className="pause-cfg__quality" role="group" aria-label="Qualidade">
                  {(
                    [
                      ["low", "Low"],
                      ["medium", "Med"],
                      ["high", "High"],
                      ["ultra", "Ultra"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`pause-cfg__qbtn${
                        settings.quality === id ? " is-on" : ""
                      }`}
                      data-sfx="toggle"
                      aria-pressed={settings.quality === id}
                      onClick={() => patch({ quality: id as QualityProfile })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pause-cfg__row">
                <span className="pause-cfg__label">
                  Flares
                  <span className="pause-cfg__hint">
                    X manual · auto em míssil inbound
                  </span>
                </span>
                <div
                  className="pause-cfg__quality"
                  role="group"
                  aria-label="Modo de flares"
                >
                  {(
                    [
                      ["manual", "Man"],
                      ["auto", "Auto"],
                      ["both", "Ambos"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`pause-cfg__qbtn${
                        settings.flareMode === id ? " is-on" : ""
                      }`}
                      data-sfx="toggle"
                      aria-pressed={settings.flareMode === id}
                      title={FLARE_MODE_LABEL[id]}
                      onClick={() => patch({ flareMode: id as FlareMode })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pause__actions pause__actions--cfg">
              <button
                type="button"
                className="btn btn--primary"
                data-sfx="confirm"
                onClick={() => setConfigOpen(false)}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {abandonOpen ? (
        <div className="game-overlay game-overlay--pause" id="abandon-overlay">
          <div className="game-overlay__bg" aria-hidden="true">
            <img
              className="game-overlay__bg-img"
              src="/ui/title_bg.jpg"
              alt=""
              decoding="async"
            />
            <div className="game-overlay__veil" />
          </div>
          <div className="overlay-card abandon">
            <h3 className="pause__title">ABANDONAR?</h3>
            <div className="pause__accent" />
            <p className="body">
              Você perde a recompensa desta partida. Credits/XP já no perfil e
              itens comprados ficam intactos.
            </p>
            <div className="pause__actions">
              <button
                type="button"
                className="btn btn--primary"
                data-sfx="confirm"
                onClick={() => setAbandonOpen(false)}
              >
                Continuar voando
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                data-sfx="deny"
                onClick={onMenu}
              >
                Sair sem recompensa
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
