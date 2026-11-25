import { useState } from "react";
import {
  FLARE_MODE_LABEL,
  avatarPublicPath,
  updateSettings,
  type FlareMode,
  type LocalProgress,
} from "@afd/game-core";
import type { QualityProfile } from "@afd/shared-types";
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
    gameAudio.applyPlayerSettings(next.settings);
    void gameAudio.unlock();
  };

  const masterPct = Math.round(s.masterVolume * 100);
  const musicPct = Math.round(s.musicVolume * 100);
  const fightMusicPct = Math.round(s.fightMusicVolume * 100);
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
                <span className="cfg-row__desc">Theme loop · hubs</span>
              </div>
              <div className="cfg-row__control cfg-row__control--slider">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={musicPct}
                  onChange={(e) =>
                    patch({ musicVolume: Number(e.target.value) / 100 })
                  }
                />
                <span className="cfg-val">{musicPct}</span>
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Música de combate</span>
                <span className="cfg-row__desc">Durante a play</span>
              </div>
              <div className="cfg-row__control">
                <Toggle
                  on={s.fightMusicEnabled}
                  onToggle={() =>
                    patch({ fightMusicEnabled: !s.fightMusicEnabled })
                  }
                />
              </div>
            </div>
            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Volume combate</span>
                <span className="cfg-row__desc">Fight theme loop</span>
              </div>
              <div className="cfg-row__control cfg-row__control--slider">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={fightMusicPct}
                  disabled={!s.fightMusicEnabled}
                  onChange={(e) =>
                    patch({ fightMusicVolume: Number(e.target.value) / 100 })
                  }
                />
                <span className="cfg-val">{fightMusicPct}</span>
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
          </div>

          <div
            className={`hub-panel cfg-panel${cat === "controls" ? " is-on" : ""}`}
            hidden={cat !== "controls"}
          >
            <header className="cfg-panel__head">
              <h2 className="cfg-panel__title">Controles</h2>
              <p className="cfg-panel__sub">
                Esquema completo de voo — teclado, mouse e free cam.
              </p>
            </header>

            <div className="cfg-row">
              <div className="cfg-row__label">
                <span>Sensibilidade do mouse</span>
                <span className="cfg-row__desc">Look · free cam · inspeção</span>
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
                <span className="cfg-row__desc">Mouse look</span>
              </div>
              <div className="cfg-row__control">
                <Toggle on={invertY} onToggle={() => setInvertY((v) => !v)} />
              </div>
            </div>

            <div className="cfg-scheme">
              <div className="cfg-scheme__board" aria-hidden="true">
                <p className="cfg-scheme__board-label">COCKPIT LAYOUT</p>
                <div className="cfg-kb">
                  <div className="cfg-kb__cluster cfg-kb__cluster--aux">
                    <span className="cfg-kb__key cfg-kb__key--sm">PgUp</span>
                    <span className="cfg-kb__key cfg-kb__key--sm">PgDn</span>
                  </div>
                  <div className="cfg-kb__cluster cfg-kb__cluster--wasd">
                    <span className="cfg-kb__key cfg-kb__key--ghost">Q</span>
                    <span className="cfg-kb__key is-hot">W</span>
                    <span className="cfg-kb__key">E</span>
                    <span className="cfg-kb__key is-hot">A</span>
                    <span className="cfg-kb__key is-hot">S</span>
                    <span className="cfg-kb__key is-hot">D</span>
                  </div>
                  <div className="cfg-kb__cluster cfg-kb__cluster--combat">
                    <span className="cfg-kb__key">C</span>
                    <span className="cfg-kb__key">F</span>
                    <span className="cfg-kb__key is-fire">V</span>
                  </div>
                  <div className="cfg-kb__cluster cfg-kb__cluster--wide">
                    <span className="cfg-kb__key cfg-kb__key--wide is-ab">
                      SHIFT
                    </span>
                    <span className="cfg-kb__key cfg-kb__key--space">
                      SPACE
                    </span>
                    <span className="cfg-kb__key cfg-kb__key--sm">ESC</span>
                  </div>
                  <div className="cfg-kb__mouse">
                    <div className="cfg-kb__mouse-body">
                      <span className="cfg-kb__mouse-btn is-lmb">LMB</span>
                      <span className="cfg-kb__mouse-btn is-rmb">RMB</span>
                    </div>
                    <span className="cfg-kb__mouse-wheel">SCROLL</span>
                  </div>
                </div>
                <ul className="cfg-scheme__legend">
                  <li>
                    <i className="is-hot" /> Stick · pitch / bank
                  </li>
                  <li>
                    <i className="is-fire" /> Fire
                  </li>
                  <li>
                    <i className="is-ab" /> Afterburner
                  </li>
                </ul>
              </div>

              <div className="cfg-scheme__groups">
                {(
                  [
                    [
                      "Voo",
                      [
                        ["Pitch up · subir", ["W", "↑"]],
                        ["Pitch down · descer", ["S", "↓"]],
                        ["Bank left · esquerda", ["A", "←"]],
                        ["Bank right · direita", ["D", "→"]],
                        ["Afterburner", ["Shift", "RMB"]],
                        ["Airbrake", ["E"]],
                        ["Barrel roll", ["F"]],
                      ],
                    ],
                    [
                      "Combate",
                      [
                        ["Disparar mísseis", ["V", "LMB"]],
                        ["Flares / dump", ["X"]],
                      ],
                    ],
                    [
                      "Câmera",
                      [
                        ["Ciclar câmera", ["Espaço"]],
                        ["Olhar para trás", ["C"]],
                        ["Inspecionar jato · hold", ["Q"]],
                        ["Look / free cam", ["Mouse"]],
                        ["Zoom · scroll", ["Wheel"]],
                      ],
                    ],
                    [
                      "Free cam",
                      [
                        ["Subir", ["PgUp"]],
                        ["Descer", ["PgDn", "Q"]],
                        ["Boost", ["Shift"]],
                      ],
                    ],
                    [
                      "Sistema",
                      [
                        ["Pausar", ["Esc"]],
                        ["Mute áudio", ["M"]],
                      ],
                    ],
                    [
                      "Tacmap · pausa",
                      [
                        ["Expandir / recolher", ["F"]],
                        ["Zoom + / −", ["+", "−"]],
                        ["Reset vista", ["0"]],
                        ["Marcar NAV", ["RMB"]],
                      ],
                    ],
                  ] as const
                ).map(([group, binds]) => (
                  <section key={group} className="cfg-bind-group">
                    <h3 className="cfg-bind-group__title">{group}</h3>
                    <div className="cfg-bind-group__list">
                      {binds.map(([label, keys]) => (
                        <button
                          key={label}
                          type="button"
                          className="cfg-bind-tile"
                          data-sfx="select"
                        >
                          <span className="cfg-bind-tile__action">{label}</span>
                          <span className="cfg-bind-tile__keys">
                            {keys.map((k) => (
                              <kbd key={k}>{k}</kbd>
                            ))}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <p className="cfg-hint">
              Layout fixo do ensaio — rebind completo chega na próxima passada.
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
                <span>Flares</span>
                <span className="cfg-row__desc">
                  X manual · auto em míssil inbound
                </span>
              </div>
              <div className="cfg-row__control">
                <div className="settings__row">
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
                      className={
                        s.flareMode === id ? "chip chip--on" : "chip"
                      }
                      data-sfx="select"
                      title={FLARE_MODE_LABEL[id]}
                      onClick={() => patch({ flareMode: id as FlareMode })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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
