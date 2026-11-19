import { CreditsChip } from "./CreditsChip";
import { HubNav, type HubId } from "./HubNav";

interface Props {
  credits: number;
  dashiCoins?: number;
  opsReady?: number;
  onPlay: () => void;
  onFreeFlight: () => void;
  onNavigate: (hub: HubId) => void;
}

export function MainMenu({
  credits,
  dashiCoins = 0,
  opsReady = 0,
  onPlay,
  onFreeFlight,
  onNavigate,
}: Props) {
  return (
    <div className="menu">
      <CreditsChip credits={credits} dashiCoins={dashiCoins} />
      {opsReady > 0 ? (
        <button
          type="button"
          className="menu__badge"
          onClick={() => onNavigate("career")}
        >
          {opsReady} missão{opsReady > 1 ? "ões" : ""} pronta{opsReady > 1 ? "s" : ""}
        </button>
      ) : null}
      <p className="menu__brand">AIR FORCE</p>
      <h1 className="menu__title">DASHI</h1>
      <div className="menu__accent" />
      <p className="menu__sub">lake country · last light · browser build</p>
      <div className="menu__actions">
        <button type="button" className="btn btn--primary" onClick={onPlay}>
          Jogar
        </button>
        <button type="button" className="btn btn--ghost" onClick={onFreeFlight}>
          Vôo Livre
        </button>
      </div>
      <div className="menu__hubs">
        <HubNav onNavigate={onNavigate} />
      </div>
      <p className="menu__hint">
        Fase M8 — DC · Battle Pass · Lobby TvT stub
      </p>
    </div>
  );
}
