import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";

interface Props {
  credits: number;
  dashiCoins?: number;
  opsReady?: number;
  callsign?: string;
  rank?: string;
  level?: number;
  avatarId?: number;
  onPlay: () => void;
  onFreeFlight: () => void;
  onNavigate: (hub: HubId) => void;
}

/** Espelho fiel de reestilo/telas/main-menu.html (+ SFX/glitch via HubFx) */
export function MainMenu({
  credits,
  dashiCoins = 0,
  opsReady = 0,
  callsign = "DASHI-1",
  rank = "Cadete",
  level = 1,
  avatarId = 0,
  onPlay,
  onFreeFlight,
  onNavigate,
}: Props) {
  return (
    <>
      <MenuTop
        mode="brand"
        credits={credits}
        dashiCoins={dashiCoins}
        opsReady={opsReady}
        callsign={callsign}
        rank={rank}
        level={level}
        avatarId={avatarId}
        showPilot
        showOpsBadge
        onNavigate={onNavigate}
        onOps={() => onNavigate("career")}
      />

      <main className="menu-shell">
        <nav className="menu-rail" aria-label="Menu principal">
          <button
            type="button"
            className="rail-item rail-item--primary is-on glitch-el"
            data-sfx="confirm"
            onClick={onPlay}
            onMouseEnter={(e) => {
              e.currentTarget.parentElement
                ?.querySelectorAll(".rail-item")
                .forEach((el) => el.classList.remove("is-on"));
              e.currentTarget.classList.add("is-on");
            }}
          >
            <span className="rail-item__bar" aria-hidden="true" />
            <span className="rail-item__label">Jogar</span>
            <span className="rail-item__hint">Pré-partida · modos</span>
          </button>

          <button
            type="button"
            className="rail-item glitch-el"
            data-sfx="select"
            onClick={onFreeFlight}
            onMouseEnter={(e) => {
              e.currentTarget.parentElement
                ?.querySelectorAll(".rail-item")
                .forEach((el) => el.classList.remove("is-on"));
              e.currentTarget.classList.add("is-on");
            }}
          >
            <span className="rail-item__bar" aria-hidden="true" />
            <span className="rail-item__label">Voo Livre</span>
            <span className="rail-item__hint">Sandbox · sem ranking</span>
          </button>

          <div className="rail-divider" aria-hidden="true" />

          {(
            [
              ["hangar", "Hangar"],
              ["career", "Carreira"],
              ["shop", "Loja"],
              ["profile", "Perfil"],
              ["settings", "Config"],
            ] as const
          ).map(([hub, label]) => (
            <button
              key={hub}
              type="button"
              className="rail-item glitch-el"
              data-sfx="select"
              onClick={() => onNavigate(hub)}
              onMouseEnter={(e) => {
                e.currentTarget.parentElement
                  ?.querySelectorAll(".rail-item")
                  .forEach((el) => el.classList.remove("is-on"));
                e.currentTarget.classList.add("is-on");
              }}
            >
              <span className="rail-item__bar" aria-hidden="true" />
              <span className="rail-item__label">{label}</span>
            </button>
          ))}
        </nav>

        <aside className="menu-feature glitch-el" aria-label="Em destaque">
          <p className="menu-feature__kicker">OPERAÇÕES</p>
          <h2 className="menu-feature__title">Daily prontas</h2>
          <p className="menu-feature__body">
            3 checkpoints · 1 Anti-Drone · bônus 3/3 disponível.
          </p>
          <div className="menu-feature__meta">
            <span className="ops-card__cd" data-countdown="daily">
              05:12:44
            </span>
            <span className="tag tag--hot">HOT</span>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            data-sfx="select"
            onClick={() => onNavigate("career")}
          >
            Abrir Carreira
          </button>
        </aside>
      </main>

      <footer className="menu-foot">
        <p className="menu-foot__meta">
          v0.8.1-ensaio · lake country · last light
        </p>
        <p className="menu-foot__hint ds-audio-hint">
          Clique em qualquer controle para armar o áudio do cockpit.
        </p>
      </footer>
    </>
  );
}
