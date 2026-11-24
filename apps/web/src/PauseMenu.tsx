import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  WORLD_SIZE,
  buildPlaces,
  nearestPlace,
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

function mapSide(frame: { clientWidth: number; clientHeight: number }): number {
  return Math.max(frame.clientWidth, frame.clientHeight);
}

function clampPan(
  panX: number,
  panY: number,
  zoom: number,
  size: number,
): { x: number; y: number } {
  if (zoom <= 1.001 || size <= 0) return { x: 0, y: 0 };
  const limit = ((zoom - 1) / 2) * size;
  return {
    x: clamp(panX, -limit, limit),
    y: clamp(panY, -limit, limit),
  };
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
): NavWaypointMark {
  const rect = frame.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const mx = clientX - rect.left - rect.width * 0.5;
  const my = clientY - rect.top - rect.height * 0.5;
  const lx = (mx - pan.x) / zoom;
  const ly = (my - pan.y) / zoom;
  const u = clamp(0.5 + lx / size, 0, 1);
  const v = clamp(0.5 + ly / size, 0, 1);
  const half = WORLD_SIZE * 0.5;
  return {
    x: u * WORLD_SIZE - half,
    z: v * WORLD_SIZE - half,
  };
}

interface TacMapProps {
  expanded: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  dragging: boolean;
  places: PlaceOfInterest[];
  jet: PauseJetMark | null | undefined;
  jetPct: { left: number; top: number } | null;
  hoverPoi: string | null;
  setHoverPoi: Dispatch<SetStateAction<string | null>>;
  nearName: string | null;
  visibleKm: number;
  onPointerDown: (ev: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (ev: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (ev: ReactPointerEvent<HTMLDivElement>) => void;
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
  zoom,
  pan,
  dragging,
  places,
  jet,
  jetPct,
  hoverPoi,
  setHoverPoi,
  nearName,
  visibleKm,
  onPointerDown,
  onPointerMove,
  onPointerUp,
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
        className={`pause-map__frame${dragging ? " is-dragging" : ""}${
          zoom > 1.01 ? " is-zoomed" : ""
        }${expanded ? " pause-map__frame--expanded" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => {
          if (!expanded || !onMarkNav) return;
          e.preventDefault();
          onMarkNav(e.clientX, e.clientY);
        }}
      >
        <div
          className="pause-map__layer"
          style={{
            transform: expanded
              ? `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
              : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <img
            className="pause-map__img"
            src="/maps/pacific_islands/map.png"
            alt="Mapa Pacific Islands"
            decoding="async"
            draggable={false}
          />
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

        <div className="pause-map__compass" aria-hidden>
          <span>N</span>
        </div>

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
            ? "RMB marca NAV · scroll · arraste · Esc recolhe"
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

export function PauseMenu({
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
  const [dragging, setDragging] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const sizeBeforeToggleRef = useRef(0);
  zoomRef.current = zoom;
  panRef.current = pan;

  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const places = useMemo(() => buildPlaces(), []);
  const jetPct = jet ? worldToMapPct(jet.x, jet.z) : null;
  const near = jet ? nearestPlace(jet.x, jet.z, places, 4500) : null;
  const visibleKm = WORLD_KM / zoom;

  const applyView = useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    const frame = frameRef.current;
    const size = frame ? mapSide(frame) : 0;
    const z = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
    const p = clampPan(nextPan.x, nextPan.y, z, size);
    setZoom(z);
    setPan(p);
  }, []);

  const focusJet = useCallback(
    (nextZoom = Math.max(zoomRef.current, 2.4)) => {
      const frame = frameRef.current;
      if (!frame || !jetPct) {
        applyView(nextZoom, { x: 0, y: 0 });
        return;
      }
      const size = mapSide(frame);
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
      if (next <= 1.001) {
        applyView(1, { x: 0, y: 0 });
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
      ? mapSide(frameRef.current)
      : 0;
    setMapExpanded((v) => !v);
  }, []);

  useEffect(() => {
    const prev = sizeBeforeToggleRef.current;
    const id = requestAnimationFrame(() => {
      const next = frameRef.current ? mapSide(frameRef.current) : 0;
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

  const onPointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return;
    const frame = frameRef.current;
    if (!frame) return;
    frame.setPointerCapture(ev.pointerId);
    dragRef.current = {
      pointerId: ev.pointerId,
      lastX: ev.clientX,
      lastY: ev.clientY,
    };
    setDragging(true);
  };

  const onPointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== ev.pointerId) return;
    if (zoomRef.current <= 1.001) return;
    const dx = ev.clientX - drag.lastX;
    const dy = ev.clientY - drag.lastY;
    drag.lastX = ev.clientX;
    drag.lastY = ev.clientY;
    applyView(zoomRef.current, {
      x: panRef.current.x + dx,
      y: panRef.current.y + dy,
    });
  };

  const endDrag = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== ev.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      frameRef.current?.releasePointerCapture(ev.pointerId);
    } catch {
      /* already released */
    }
  };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = frame.getBoundingClientRect();
      const mx = ev.clientX - rect.left - rect.width / 2;
      const my = ev.clientY - rect.top - rect.height / 2;
      const prev = zoomRef.current;
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = clamp(prev * factor, ZOOM_MIN, ZOOM_MAX);
      if (Math.abs(next - prev) < 0.001) return;
      const wx = (mx - panRef.current.x) / prev;
      const wy = (my - panRef.current.y) / prev;
      applyView(next, {
        x: mx - wx * next,
        y: my - wy * next,
      });
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [applyView, mapExpanded]);

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
            ? mapSide(frameRef.current)
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
  const sfxPct = Math.round(settings.sfxVolume * 100);
  const sensPct = Math.round(settings.mouseSens * 100);

  const patch = (partial: Partial<PlayerSettings>) => {
    onSettingsChange(partial);
    if (partial.masterVolume != null || partial.sfxVolume != null) {
      const master = partial.masterVolume ?? settings.masterVolume;
      const sfx = partial.sfxVolume ?? settings.sfxVolume;
      gameAudio.setVolumes(master, sfx);
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
    zoom,
    pan,
    dragging,
    places,
    jet,
    jetPct,
    hoverPoi,
    setHoverPoi,
    nearName: near?.name ?? null,
    visibleKm,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
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
}
