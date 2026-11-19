import type { MissionRewardDto } from "@afd/shared-types";
import { HubFx } from "./HubFx";
import { MenuTop } from "./MenuTop";

interface Props {
  reward: MissionRewardDto;
  credits?: number;
  dashiCoins?: number;
  onRetry: () => void;
  onMenu: () => void;
  onHangar?: () => void;
  onModes?: () => void;
}

export function ResultOverlay({
  reward,
  credits = 0,
  dashiCoins = 0,
  onRetry,
  onMenu,
  onHangar,
  onModes,
}: Props) {
  return (
    <div className="tela tela--hub tela--result result-overlay">
      <HubFx screenKey="result">
      <MenuTop
        mode="hub"
        kicker="AFTER ACTION"
        title="Resultado"
        credits={credits}
        dashiCoins={dashiCoins}
        backLabel="← HUD"
        onBack={onRetry}
      />

      <main className="aar-shell glitch-el">
        <section className="aar-hero">
          <p className="aar-hero__kicker">
            {reward.mode.toUpperCase()} · Lv {reward.level} ·{" "}
            {reward.callsign.toUpperCase()}
          </p>
          <h2 className="aar-hero__title">{reward.won ? "CLEAR" : "FAIL"}</h2>
          <div className="aar-hero__accent" />
          <div className="aar-hero__claim">
            <span className={`tag ${reward.won ? "tag--ok" : "tag--warn"}`}>
              {reward.won ? "REIVINDICAR" : "SEM CLAIM"}
            </span>
            <span className="meta">
              +{reward.creditsPreview} CR · +{reward.xpPreview} XP
            </span>
          </div>
        </section>

        <section className="aar-stats" aria-label="Recompensas">
          <article className="aar-stat">
            <span className="aar-stat__label">Credits</span>
            <strong className="aar-stat__value">+{reward.creditsPreview}</strong>
          </article>
          <article className="aar-stat">
            <span className="aar-stat__label">XP</span>
            <strong className="aar-stat__value">+{reward.xpPreview}</strong>
          </article>
          <article className="aar-stat">
            <span className="aar-stat__label">Tempo restante</span>
            <strong className="aar-stat__value">
              {reward.timeLeftSec != null
                ? `${reward.timeLeftSec.toFixed(1)}s`
                : "—"}
            </strong>
          </article>
          <article className="aar-stat">
            <span className="aar-stat__label">
              {reward.kills != null ? "Kills" : "Daily"}
            </span>
            <strong className="aar-stat__value">
              {reward.kills != null ? reward.kills : "2/3"}
            </strong>
          </article>
        </section>

        <nav className="aar-actions" aria-label="Próximos passos">
          <button
            type="button"
            className="btn btn--primary"
            data-sfx="confirm"
            onClick={onRetry}
          >
            Jogar de novo
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            data-sfx="select"
            onClick={onModes ?? onMenu}
          >
            Trocar modo
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            data-sfx="select"
            onClick={onHangar ?? onMenu}
          >
            Hangar
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            data-sfx="select"
            onClick={onMenu}
          >
            Menu
          </button>
        </nav>
      </main>
      </HubFx>
    </div>
  );
}
