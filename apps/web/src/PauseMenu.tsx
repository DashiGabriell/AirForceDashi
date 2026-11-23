import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  WORLD_SIZE,
  buildPlaces,
  nearestPlace,
  type PlayerSettings,
} from "@afd/game-core";
import type { QualityProfile } from "@afd/shared-types";
import { gameAudio, type UiSfxRole } from "./audio/GameAudio";

export interface PauseJetMark {
  x: number;
  z: number;
  /** Heading in degrees (0 = north / −Z). */
  headingDeg: number;
}

interface Props {
  onResume: () => void;
  onMenu: () => void;
  /** Ex.: "CHECKPOINT · Lv 3 · tempo congelado" */
  meta?: string;
  jet?: PauseJetMark | null;
  settings: PlayerSettings;
  onSettingsChange: (partial: Partial<PlayerSettings>) => void;
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

export function PauseMenu({
  onResume,
  onMenu,
  meta,
  jet,
  settings,
  onSettingsChange,
}: Props) {
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoverPoi, setHoverPoi] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
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
    const size = frame?.clientWidth ?? 0;
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
      const size = frame.clientWidth;
      const z = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
      // Map % → offset from center in layer pixels at scale 1, then * zoom
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
  }, [applyView]);

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abandonOpen, bumpZoom, configOpen, resetView]);

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

  const showPoiLabels = zoom >= 1.8;

  return (
    <div ref={rootRef} className="pause-root">
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
            <section className="pause-map" aria-label="Mapa tático">
              <header className="pause-map__head">
                <div className="pause-map__head-main">
                  <span className="pause-map__kicker">TACMAP</span>
                  <span className="pause-map__title">Pacific Islands</span>
                </div>
                <div className="pause-map__head-meta">
                  <span className="pause-map__chip">
                    {visibleKm.toFixed(1)} km vista
                  </span>
                  <span className="pause-map__chip pause-map__chip--zoom">
                    ×{zoom.toFixed(1)}
                  </span>
                </div>
              </header>

              <div
                ref={frameRef}
                className={`pause-map__frame${dragging ? " is-dragging" : ""}${
                  zoom > 1.01 ? " is-zoomed" : ""
                }`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  if (zoom > 1.05) resetView();
                  else focusJet(2.6);
                }}
              >
                <div
                  className="pause-map__layer"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
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
                        onMouseLeave={() =>
                          setHoverPoi((cur) => (cur === p.name ? null : cur))
                        }
                        onFocus={() => setHoverPoi(p.name)}
                        onBlur={() =>
                          setHoverPoi((cur) => (cur === p.name ? null : cur))
                        }
                      >
                        {showPoiLabels || hoverPoi === p.name ? (
                          <span className="pause-map__poi-label">{p.name}</span>
                        ) : null}
                      </button>
                    );
                  })}
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
                </div>

                <div className="pause-map__hint" aria-hidden>
                  scroll · arraste · duplo-clique
                </div>
              </div>

              <div className="pause-map__legend" aria-hidden>
                <span className="pause-map__leg pause-map__leg--jet">Você</span>
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
                      <em>NEAR</em>{" "}
                      {hoverPoi ?? near?.name ?? "—"}
                    </span>
                  </>
                ) : (
                  <span>Posição indisponível</span>
                )}
              </footer>
            </section>

            <div className="pause__side">
              <p className="pause__status">
                <span className="pause__status-dot" aria-hidden />
                Sistema em espera
              </p>
              <h3 className="pause__title">PAUSA</h3>
              <div className="pause__accent" />
              {meta ? <p className="pause__meta">{meta}</p> : null}
              <p className="pause__side-copy">
                Tempo congelado. Ajuste o tacmap ou retome o voo.
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
