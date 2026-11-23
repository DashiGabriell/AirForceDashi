import { useState } from "react";
import { avatarPublicPath } from "@afd/game-core";
import {
  createLobbyApi,
  grantMatchReward,
} from "./api/economyClient";
import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";

interface Props {
  apiToken: string | null;
  callsign: string;
  credits?: number;
  dashiCoins?: number;
  onCredits: (credits: number) => void;
  onNavigate: (hub: HubId) => void;
  onBack?: () => void;
}

export function Lobby({
  apiToken,
  callsign,
  credits = 0,
  onCredits,
  onNavigate,
  onBack,
}: Props) {
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const you = callsign.toUpperCase() || "VIPER-1";
  const avatar = avatarPublicPath(0);

  const ensureRoom = async () => {
    if (!apiToken) return;
    try {
      await createLobbyApi(apiToken);
    } catch {
      /* visual lobby remains */
    }
  };

  const simulateMatch = async (won: boolean) => {
    if (!apiToken) {
      setMsg("Matchmaking stub · expansão");
      return;
    }
    setBusy(true);
    try {
      await ensureRoom();
      const matchId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `tvt-${Date.now()}`;
      const res = await grantMatchReward(apiToken, {
        matchId,
        mode: "tvt",
        won,
      });
      onCredits(res.wallet.credits);
      setMsg(
        won
          ? `Vitória TvT stub · +${res.credited} Credits`
          : `Participação TvT · +${res.credited} Credits`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha no grant");
    } finally {
      setBusy(false);
    }
  };

  const readyCount = ready ? 3 : 2;

  return (
    <>
      <MenuTop
        mode="hub"
        kicker="TEAM VS TEAM"
        title="Lobby"
        roomChip="SALA · LOCAL"
        credits={credits}
        backLabel="← Pré"
        onBack={onBack ?? (() => onNavigate("menu"))}
        onNavigate={onNavigate}
      />

      <main className="lobby-stage">
        <section className="lobby-match glitch-el" aria-label="Partida">
          <p className="lobby-match__mode">TEAM VS TEAM</p>
          <h2 className="lobby-match__map">Pacific Islands</h2>
          <p className="lobby-match__rules">dusk · 4v4 · skill match por piloto</p>
          <div className="lobby-match__vs" aria-hidden="true">
            VS
          </div>
          <div className="lobby-match__status">
            <span className="lobby-match__pulse" aria-hidden="true" />
            <span data-lobby-status>
              Aguardando prontos · {readyCount} / 8
            </span>
          </div>
          <p className="lobby-match__note">
            Avião pago não altera combate — só identidade.
          </p>
        </section>

        <div className="lobby-teams">
          <section
            className="lobby-team lobby-team--blue glitch-el"
            aria-label="Time Blue"
          >
            <header className="lobby-team__head">
              <h3 className="lobby-team__name">BLUE</h3>
              <span className="lobby-team__count">2 / 4</span>
            </header>
            <ul className="lobby-slots">
              <li
                className={`lobby-slot is-you${ready ? " is-ready" : ""}`}
              >
                <img className="lobby-slot__avatar" src={avatar} alt="" />
                <div className="lobby-slot__info">
                  <span className="lobby-slot__name">
                    {you}{" "}
                    <span className="lobby-slot__you">VOCÊ</span>
                  </span>
                  <span className="lobby-slot__ac">F-22 RAPTOR · Host</span>
                </div>
                <span
                  className={`lobby-slot__ready tag ${
                    ready ? "tag--ok" : "tag--warn"
                  }`}
                >
                  {ready ? "READY" : "WAIT"}
                </span>
              </li>
              <li className="lobby-slot is-ready">
                <img
                  className="lobby-slot__avatar"
                  src={avatarPublicPath(1)}
                  alt=""
                />
                <div className="lobby-slot__info">
                  <span className="lobby-slot__name">ACE-9</span>
                  <span className="lobby-slot__ac">F-15 EAGLE</span>
                </div>
                <span className="lobby-slot__ready tag tag--ok">READY</span>
              </li>
              <li className="lobby-slot is-open">
                <div
                  className="lobby-slot__avatar lobby-slot__avatar--empty"
                  aria-hidden="true"
                >
                  +
                </div>
                <div className="lobby-slot__info">
                  <span className="lobby-slot__name">OPEN SLOT</span>
                  <span className="lobby-slot__ac">Aguardando piloto</span>
                </div>
                <span className="lobby-slot__ready tag tag--dim">—</span>
              </li>
              <li className="lobby-slot is-open">
                <div
                  className="lobby-slot__avatar lobby-slot__avatar--empty"
                  aria-hidden="true"
                >
                  +
                </div>
                <div className="lobby-slot__info">
                  <span className="lobby-slot__name">OPEN SLOT</span>
                  <span className="lobby-slot__ac">Aguardando piloto</span>
                </div>
                <span className="lobby-slot__ready tag tag--dim">—</span>
              </li>
            </ul>
          </section>

          <section
            className="lobby-team lobby-team--red glitch-el"
            aria-label="Time Red"
          >
            <header className="lobby-team__head">
              <h3 className="lobby-team__name">RED</h3>
              <span className="lobby-team__count">1 / 4</span>
            </header>
            <ul className="lobby-slots">
              <li className="lobby-slot">
                <img
                  className="lobby-slot__avatar"
                  src={avatarPublicPath(2)}
                  alt=""
                />
                <div className="lobby-slot__info">
                  <span className="lobby-slot__name">GHOST</span>
                  <span className="lobby-slot__ac">F-22 RAPTOR</span>
                </div>
                <span className="lobby-slot__ready tag tag--warn">WAIT</span>
              </li>
              {[0, 1, 2].map((i) => (
                <li key={i} className="lobby-slot is-open">
                  <div
                    className="lobby-slot__avatar lobby-slot__avatar--empty"
                    aria-hidden="true"
                  >
                    +
                  </div>
                  <div className="lobby-slot__info">
                    <span className="lobby-slot__name">OPEN SLOT</span>
                    <span className="lobby-slot__ac">Aguardando piloto</span>
                  </div>
                  <span className="lobby-slot__ready tag tag--dim">—</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {msg ? <p className="hub__empty">{msg}</p> : null}
      </main>

      <footer className="lobby-dock">
        <div className="lobby-dock__meta">
          <span className="tag">Ping 28ms</span>
          <span className="meta">Matchmaking stub · expansão</span>
        </div>
        <div className="lobby-dock__cta">
          <button
            type="button"
            className="btn btn--ghost"
            data-sfx="select"
            onClick={onBack ?? (() => onNavigate("menu"))}
          >
            Sair
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            data-sfx="select"
              onClick={() => onNavigate("hangar")}
          >
            Loadout
          </button>
          <button
            type="button"
            className={`btn btn--primary lobby-dock__ready${
              ready ? " is-ready" : ""
            }`}
            aria-pressed={ready}
            disabled={busy}
            data-sfx="confirm"
              onClick={() => {
              const next = !ready;
              setReady(next);
              if (next) void simulateMatch(true);
            }}
          >
            Pronto
          </button>
        </div>
      </footer>
    </>
  );
}
