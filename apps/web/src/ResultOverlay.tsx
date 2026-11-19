import type { MissionRewardDto } from "@afd/shared-types";

interface Props {
  reward: MissionRewardDto;
  onRetry: () => void;
  onMenu: () => void;
}

export function ResultOverlay({ reward, onRetry, onMenu }: Props) {
  return (
    <div className="result">
      <h2 className="result__title">{reward.won ? "CLEAR" : "FAIL"}</h2>
      <div className="result__accent" />
      <p className="result__meta">
        {reward.mode.toUpperCase()} · Lv {reward.level} · {reward.callsign}
      </p>
      <ul className="result__stats">
        <li>
          Credits <strong>+{reward.creditsPreview}</strong>
          <span className="result__hint">preview offline</span>
        </li>
        <li>
          XP <strong>+{reward.xpPreview}</strong>
        </li>
        {reward.timeLeftSec != null ? (
          <li>
            Tempo restante <strong>{reward.timeLeftSec.toFixed(1)}s</strong>
          </li>
        ) : null}
        {reward.kills != null ? (
          <li>
            Kills <strong>{reward.kills}</strong>
          </li>
        ) : null}
      </ul>
      <div className="result__actions">
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Retry
        </button>
        <button type="button" className="btn btn--ghost" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}
