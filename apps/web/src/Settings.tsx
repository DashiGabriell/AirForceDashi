import { useState } from "react";
import { updateSettings, type LocalProgress } from "@afd/game-core";
import type { QualityProfile } from "@afd/shared-types";
import { avatarPublicPath } from "@afd/game-core";
import { gameAudio } from "./audio/GameAudio";
import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";

interface Props {
  progress: LocalProgress;
  onProgress: (p: LocalProgress) => void;
  onNavigate: (hub: HubId) => void;
}

type Cat = "audio" | "controls" | "graphics" | "gameplay" | "account";

function Toggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`toggle${on ? " is-on" : ""}`}
      data-sfx="toggle"
      aria-pressed={on}
      onClick={onToggle}
    >
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
      {on ? "ON" : "OFF"}
    </button>
  );
}

export function Settings({ progress, onProgress, onNavigate }: Props) {
  const s = progress.settings;
  const [cat, setCat] = useState<Cat>("audio");
  const [musicVol, setMusicVol] = useState(28);
  const [gameSound, setGameSound] = useState(true);
  const [invertY, setInvertY] = useState(false);
  const [shadows, setShadows] = useState<"OFF" | "MED" | "HIGH">("MED");
  const [aa, setAa] = useState<"OFF" | "FXAA" | "TAA">("FXAA");
  const [vsync, setVsync] = useState(true);
  const [motionBlur, setMotionBlur] = useState(false);
  const [hudOpacity, setHudOpacity] = useState(90);
  const [dmgNumbers, setDmgNumbers] = useState(true);
  const [glitch, setGlitch] = useState(true);
  const [lang, setLang] = useState<"PT-BR" | "EN">("PT-BR");

  const patch = (partial: Parameters<typeof updateSettings>[1]) => {
    const next = updateSettings(progress, partial);
    onProgress(next);
    gameAudio.setVolumes(next.settings.masterVolume, next.settings.sfxVolume);
    void gameAudio.unlock();
  };

  const masterPct = Math.round(s.masterVolume * 100);
  const sfxPct = Math.round(s.sfxVolume * 100);
  const sensPct = Math.round(s.mouseSens * 100);

  return (
    <>
      <MenuTop
        mode="hub"
        kicker="OPTIONS"
        title="Config"
        versionChip="v0.8.1"
        onBack={() => onNavigate("menu")}
        onNavigate={onNavigate}
      />

      <main className="cfg-shell">
        <nav className="cfg-cats glitch-el" aria-label="Categorias">
          {(
            [
              ["audio", "Áudio", "Volumes · mix"],
              ["controls", "Controles", "Mouse · keybinds"],
              ["graphics", "Gráficos", "Qualidade · FX"],
              ["gameplay", "Gameplay", "HUD · feedback"],
              ["account", "Conta", "Save · versão"],
            ] as const
          ).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              className={`cfg-cat${cat === id ? " is-on" : ""}`}
              data-sfx="select"
              onClick={() => setCat(id)}
            >
              <span className="cfg-cat__label">{label}</span>
              <span className="cfg-cat__hint">{hint}</span>
            </button>
          ))}
        </nav>

        <section className="cfg-panel-wrap glitch-el">
          <div
            className={`hub-panel cfg-panel${cat === "audio" ? " is-on" : ""}`}
            hidden={cat !== "audio"}
          >
            <header className="cfg-panel__head">
              <h2 className="cfg-panel__title">Áudio</h2>
              <p className="cfg-panel__sub">
                Mix do cockpit — master, música e SFX de UI.
              </p>
            </header>

            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Volume master</span>
                <span className="cfg-row__desc">Saída geral</span>
              </div>
              <div className="cfg-row__control cfg-row__control--slider">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={masterPct}
                  onChange={(e) =>
                    patch({ masterVolume: Number(e.target.value) / 100 })
                  }
                />
                <span className="cfg-val">{masterPct}</span>
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Música do menu</span>
                <span className="cfg-row__desc">Theme loop</span>
              </div>
              <div className="cfg-row__control cfg-row__control--slider">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={musicVol}
                  onChange={(e) => setMusicVol(Number(e.target.value))}
                />
                <span className="cfg-val">{musicVol}</span>
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>SFX de UI</span>
                <span className="cfg-row__desc">Select · confirm · deny</span>
              </div>
              <div className="cfg-row__control cfg-row__control--slider">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sfxPct}
                  onChange={(e) =>
                    patch({ sfxVolume: Number(e.target.value) / 100 })
                  }
                />
                <span className="cfg-val">{sfxPct}</span>
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Som do jogo</span>
                <span className="cfg-row__desc">Motor · armas · ambiente</span>
              </div>
              <div className="cfg-row__control">
                <Toggle on={gameSound} onToggle={() => setGameSound((v) => !v)} />
              </div>
            </div>
          </div>

          <div
            className={`hub-panel cfg-panel${cat === "controls" ? " is-on" : ""}`}
            hidden={cat !== "controls"}
          >
            <header className="cfg-panel__head">
              <h2 className="cfg-panel__title">Controles</h2>
              <p className="cfg-panel__sub">
                Sensibilidade e mapa de teclas — desktop primeiro.
              </p>
            </header>

            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Sensibilidade do mouse</span>
                <span className="cfg-row__desc">Look / camera</span>
              </div>
              <div className="cfg-row__control cfg-row__control--slider">
                <input
                  type="range"
                  min={35}
                  max={200}
                  value={sensPct}
                  onChange={(e) =>
                    patch({ mouseSens: Number(e.target.value) / 100 })
                  }
                />
                <span className="cfg-val">{s.mouseSens.toFixed(2)}</span>
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Inverter eixo Y</span>
              </div>
              <div className="cfg-row__control">
                <Toggle on={invertY} onToggle={() => setInvertY((v) => !v)} />
              </div>
            </div>

            <p className="cfg-section-label">Keybinds</p>
            <div className="cfg-binds">
              {(
                [
                  ["Pitch / Roll", "WASD"],
                  ["Look", "Mouse"],
                  ["Missiles", "Espaço"],
                  ["Afterburner", "Shift"],
                  ["Pause", "Esc"],
                  ["Scoreboard", "Tab"],
                ] as const
              ).map(([label, key]) => (
                <button key={label} type="button" className="cfg-bind" data-sfx="select">
                  <span>{label}</span>
                  <kbd>{key}</kbd>
                </button>
              ))}
            </div>
            <p className="cfg-hint">
              Clique um bind para reatribuir (ensaio visual).
            </p>
          </div>

          <div
            className={`hub-panel cfg-panel${cat === "graphics" ? " is-on" : ""}`}
            hidden={cat !== "graphics"}
          >
            <header className="cfg-panel__head">
              <h2 className="cfg-panel__title">Gráficos</h2>
              <p className="cfg-panel__sub">
                Preset rápido + overrides do ensaio.
              </p>
            </header>

            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Qualidade</span>
                <span className="cfg-row__desc">Preset</span>
              </div>
              <div className="cfg-row__control">
                <div className="settings__row">
                  {(["low", "medium", "high", "ultra"] as QualityProfile[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={s.quality === q ? "chip chip--on" : "chip"}
                      data-sfx="select"
              onClick={() => patch({ quality: q })}
                    >
                      {q.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Sombras</span>
              </div>
              <div className="cfg-row__control">
                <div className="settings__row">
                  {(["OFF", "MED", "HIGH"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={shadows === v ? "chip chip--on" : "chip"}
                      data-sfx="select"
              onClick={() => setShadows(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Anti-aliasing</span>
              </div>
              <div className="cfg-row__control">
                <div className="settings__row">
                  {(["OFF", "FXAA", "TAA"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={aa === v ? "chip chip--on" : "chip"}
                      data-sfx="select"
              onClick={() => setAa(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>VSync</span>
              </div>
              <div className="cfg-row__control">
                <Toggle on={vsync} onToggle={() => setVsync((v) => !v)} />
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Motion blur</span>
              </div>
              <div className="cfg-row__control">
                <Toggle
                  on={motionBlur}
                  onToggle={() => setMotionBlur((v) => !v)}
                />
              </div>
            </div>
          </div>

          <div
            className={`hub-panel cfg-panel${cat === "gameplay" ? " is-on" : ""}`}
            hidden={cat !== "gameplay"}
          >
            <header className="cfg-panel__head">
              <h2 className="cfg-panel__title">Gameplay</h2>
              <p className="cfg-panel__sub">
                HUD e feedback — sem alterar combate competitivo.
              </p>
            </header>

            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>HUD opacity</span>
              </div>
              <div className="cfg-row__control cfg-row__control--slider">
                <input
                  type="range"
                  min={40}
                  max={100}
                  value={hudOpacity}
                  onChange={(e) => setHudOpacity(Number(e.target.value))}
                />
                <span className="cfg-val">{hudOpacity}</span>
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Damage numbers</span>
              </div>
              <div className="cfg-row__control">
                <Toggle
                  on={dmgNumbers}
                  onToggle={() => setDmgNumbers((v) => !v)}
                />
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Glitch de entrada</span>
                <span className="cfg-row__desc">Transição de telas</span>
              </div>
              <div className="cfg-row__control">
                <Toggle on={glitch} onToggle={() => setGlitch((v) => !v)} />
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Idioma</span>
              </div>
              <div className="cfg-row__control">
                <div className="settings__row">
                  {(["PT-BR", "EN"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={lang === v ? "chip chip--on" : "chip"}
                      data-sfx="select"
              onClick={() => setLang(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`hub-panel cfg-panel${cat === "account" ? " is-on" : ""}`}
            hidden={cat !== "account"}
          >
            <header className="cfg-panel__head">
              <h2 className="cfg-panel__title">Conta</h2>
              <p className="cfg-panel__sub">
                Identidade local e sync — sem paywall técnico.
              </p>
            </header>

            <div className="cfg-account">
              <div className="cfg-account__card">
                <img
                  className="cfg-account__avatar"
                  src={avatarPublicPath(progress.avatarId)}
                  alt=""
                />
                <div>
                  <p className="cfg-account__name">
                    {progress.callsign.toUpperCase()}
                  </p>
                  <p className="cfg-account__meta">guest local · Capitão Lv 14</p>
                </div>
              </div>
              <ul className="hub__list">
                <li>
                  <span>Save</span>
                  <strong>online OK</strong>
                </li>
                <li>
                  <span>Build</span>
                  <strong>v0.8.1-ensaio</strong>
                </li>
                <li>
                  <span>Motor</span>
                  <strong>Three · WebGL2</strong>
                </li>
                <li>
                  <span>Plataforma</span>
                  <strong>Web</strong>
                </li>
              </ul>
              <div className="row wrap" style={{ marginTop: 14, gap: 10 }}>
                <button type="button" className="btn btn--ghost btn--sm" data-sfx="select">
                  Vincular conta
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  data-sfx="select"
              onClick={() => onNavigate("profile")}
                >
                  Abrir Perfil
                </button>
                <button type="button" className="btn btn--ghost btn--sm" data-sfx="select">
                  Apagar save
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="cfg-dock">
        <button type="button" className="btn btn--ghost btn--sm" data-sfx="select">
          Restaurar padrão
        </button>
        <div className="cfg-dock__right">
          <button
            type="button"
            className="btn btn--ghost"
            data-sfx="select"
              onClick={() => onNavigate("menu")}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            data-sfx="confirm"
              onClick={() => onNavigate("menu")}
          >
            Aplicar
          </button>
        </div>
      </footer>
    </>
  );
}
