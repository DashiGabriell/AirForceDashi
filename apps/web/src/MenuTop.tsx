import { avatarPublicPath, clampAvatarId } from "@afd/game-core";
import type { HubId } from "./HubNav";

function fmt(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString("pt-BR");
}

interface Props {
  /** Brand wordmark (main menu) OR back + title (hubs). */
  mode: "brand" | "hub";
  kicker?: string;
  title?: string;
  credits?: number;
  dashiCoins?: number;
  opsReady?: number;
  callsign?: string;
  rank?: string;
  level?: number;
  avatarId?: number;
  showPilot?: boolean;
  showAudio?: boolean;
  /** Quando true, mostra o badge mesmo com 0 (main-menu.html sempre tem o chip). */
  showOpsBadge?: boolean;
  versionChip?: string;
  roomChip?: string;
  backLabel?: string;
  onBack?: (() => void) | undefined;
  onNavigate?: ((hub: HubId) => void) | undefined;
  onOps?: (() => void) | undefined;
}

export function MenuTop({
  mode,
  kicker = "HUB",
  title = "",
  credits,
  dashiCoins,
  opsReady = 0,
  callsign = "DASHI-1",
  rank = "Cadete",
  level = 1,
  avatarId = 0,
  showPilot = false,
  showAudio = true,
  showOpsBadge = false,
  versionChip,
  roomChip,
  backLabel = "← Menu",
  onBack,
  onNavigate,
  onOps,
}: Props) {
  const avatar = avatarPublicPath(clampAvatarId(avatarId));
  const rankLine = `${rank} · Lv ${Math.max(1, Math.floor(level))}`;
  const showOps = showOpsBadge || opsReady > 0;

  return (
    <header className="menu-top">
      {mode === "brand" ? (
        <div className="menu-top__brand">
          <img
            className="menu-top__logo"
            src="/ui/logo.png"
            alt="Air Force Dashi"
          />
        </div>
      ) : (
        <div className="menu-top__left">
          {onBack ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm glitch-el"
              data-sfx="select"
              onClick={onBack}
            >
              {backLabel}
            </button>
          ) : null}
          <div className="pre-title glitch-el">
            <span className="pre-title__kicker">{kicker}</span>
            <h1 className="pre-title__name">{title}</h1>
          </div>
        </div>
      )}

      <div className="menu-top__right">
        {roomChip ? (
          <div className="menu__chip glitch-el">{roomChip}</div>
        ) : null}
        {credits != null ? (
          <div
            className="menu__chip menu__chip--currency glitch-el"
            aria-label={`Credits ${fmt(credits)}`}
          >
            <span className="menu__chip-icon-wrap" aria-hidden>
              <img
                className="menu__chip-icon"
                src="/ui/currency/icon_cr.png"
                alt=""
                width={26}
                height={26}
                draggable={false}
              />
            </span>
            <span>{fmt(credits)}</span>
          </div>
        ) : null}
        {dashiCoins != null ? (
          <div
            className="menu__chip menu__chip--currency glitch-el"
            aria-label={`Dashi Coins ${fmt(dashiCoins)}`}
          >
            <span className="menu__chip-icon-wrap" aria-hidden>
              <img
                className="menu__chip-icon"
                src="/ui/currency/icon_dc.png"
                alt=""
                width={26}
                height={26}
                draggable={false}
              />
            </span>
            <span>{fmt(dashiCoins)}</span>
          </div>
        ) : null}
        {versionChip ? (
          <div className="menu__chip glitch-el">{versionChip}</div>
        ) : null}
        {showOps ? (
          <button
            type="button"
            className="menu__badge glitch-el"
            data-sfx="confirm"
            onClick={() => {
              onOps?.();
              onNavigate?.("career");
            }}
          >
            {opsReady} {opsReady === 1 ? "missão" : "missões"}
          </button>
        ) : null}
        {showPilot ? (
          <button
            type="button"
            className="pilot-chip glitch-el"
            data-sfx="select"
            aria-label="Perfil"
            onClick={() => onNavigate?.("profile")}
          >
            <img
              className="pilot-chip__avatar"
              src={avatar}
              alt=""
              width={34}
              height={34}
              draggable={false}
            />
            <span className="pilot-chip__text">
              <span className="pilot-chip__name">{callsign.toUpperCase()}</span>
              <span className="pilot-chip__rank">{rankLine}</span>
            </span>
          </button>
        ) : null}
        {showAudio ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm btn--icon glitch-el"
            data-audio-toggle
            data-sfx="toggle"
            aria-pressed="false"
            title="Áudio"
          >
            ♪
          </button>
        ) : null}
      </div>
    </header>
  );
}
