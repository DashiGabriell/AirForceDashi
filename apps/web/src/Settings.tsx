import { updateSettings, type LocalProgress } from "@afd/game-core";
import type { QualityProfile } from "@afd/shared-types";
import { HubNav, type HubId } from "./HubNav";

interface Props {
  progress: LocalProgress;
  onProgress: (p: LocalProgress) => void;
  onNavigate: (hub: HubId) => void;
}

const QUALITIES: QualityProfile[] = ["low", "medium", "high"];

export function Settings({ progress, onProgress, onNavigate }: Props) {
  const s = progress.settings;

  const patch = (partial: Parameters<typeof updateSettings>[1]) => {
    onProgress(updateSettings(progress, partial));
  };

  return (
    <div className="hub">
      <button type="button" className="pre__back" onClick={() => onNavigate("menu")}>
        ← Menu
      </button>
      <HubNav active="settings" onNavigate={onNavigate} />
      <h1 className="hub__title">CONFIG</h1>
      <div className="pre__accent" />

      <div className="settings__block">
        <span className="settings__label">Qualidade</span>
        <div className="settings__row">
          {QUALITIES.map((q) => (
            <button
              key={q}
              type="button"
              className={s.quality === q ? "pre__chip pre__chip--on" : "pre__chip"}
              onClick={() => patch({ quality: q })}
            >
              {q.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <label className="settings__block">
        <span className="settings__label">
          Volume master · {Math.round(s.masterVolume * 100)}%
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.masterVolume}
          onChange={(e) => patch({ masterVolume: Number(e.target.value) })}
        />
      </label>

      <label className="settings__block">
        <span className="settings__label">
          SFX · {Math.round(s.sfxVolume * 100)}%
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.sfxVolume}
          onChange={(e) => patch({ sfxVolume: Number(e.target.value) })}
        />
      </label>

      <label className="settings__block">
        <span className="settings__label">
          Sensibilidade mouse · {s.mouseSens.toFixed(2)}
        </span>
        <input
          type="range"
          min={0.35}
          max={2}
          step={0.05}
          value={s.mouseSens}
          onChange={(e) => patch({ mouseSens: Number(e.target.value) })}
        />
      </label>

      <p className="hub__empty">
        Áudio é stub até o bus web (M6). Qualidade altera resolução interna do voo.
      </p>
    </div>
  );
}
