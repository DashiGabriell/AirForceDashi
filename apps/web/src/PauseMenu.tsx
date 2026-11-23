import { useEffect, useMemo, useRef, useState } from "react";
import {
  WORLD_SIZE,
  buildPlaces,
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
  const rootRef = useRef<HTMLDivElement>(null);
  const places = useMemo(() => buildPlaces(), []);

  const jetPct = jet ? worldToMapPct(jet.x, jet.z) : null;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onPointerDown = (ev: PointerEvent) => {
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

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerenter", onPointerEnter, true);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerenter", onPointerEnter, true);
    };
  }, []);

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
                <span className="pause-map__kicker">TACMAP</span>
                <span className="pause-map__title">Pacific Islands</span>
                <span className="pause-map__scale">16 × 16 km</span>
              </header>
              <div className="pause-map__frame">
                <img
                  className="pause-map__img"
                  src="/maps/pacific_islands/map.png"
                  alt="Mapa Pacific Islands"
                  decoding="async"
                  draggable={false}
                />
                {places.map((p) => {
                  const pct = worldToMapPct(p.x, p.z);
                  return (
                    <span
                      key={p.name}
                      className={`pause-map__poi pause-map__poi--${p.kind.toLowerCase()}`}
                      style={{ left: `${pct.left}%`, top: `${pct.top}%` }}
                      title={p.name}
                    />
                  );
                })}
                {jetPct ? (
                  <span
                    className="pause-map__jet"
                    style={{
                      left: `${jetPct.left}%`,
                      top: `${jetPct.top}%`,
                      transform: `translate(-50%, -50%) rotate(${jet?.headingDeg ?? 0}deg)`,
                    }}
                    title="Sua posição"
                  >
                    <span className="pause-map__jet-nose" aria-hidden />
                  </span>
                ) : null}
              </div>
              <footer className="pause-map__footer">
                {jet ? (
                  <>
                    <span>
                      POS {formatCoord(jet.x)} · {formatCoord(jet.z)}
                    </span>
                    <span>
                      HDG {Math.floor(((jet.headingDeg % 360) + 360) % 360)}°
                    </span>
                  </>
                ) : (
                  <span>Posição indisponível</span>
                )}
              </footer>
            </section>

            <div className="pause__side">
              <h3 className="pause__title">PAUSA</h3>
              <div className="pause__accent" />
              {meta ? <p className="pause__meta">{meta}</p> : null}
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
