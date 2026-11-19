import { useState } from "react";
import {
  createLobbyApi,
  grantMatchReward,
  type LobbyStub,
} from "./api/economyClient";
import { HubNav } from "./HubNav";

interface Props {
  apiToken: string | null;
  callsign: string;
  onCredits: (credits: number) => void;
  onNavigate: (
    hub: "menu" | "hangar" | "career" | "shop" | "profile" | "settings" | "lobby",
  ) => void;
}

export function Lobby({ apiToken, callsign, onCredits, onNavigate }: Props) {
  const [room, setRoom] = useState<LobbyStub | null>(null);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!apiToken) {
      setMsg("API offline — lobby stub precisa do servidor");
      return;
    }
    setBusy(true);
    try {
      const lob = await createLobbyApi(apiToken);
      setRoom(lob);
      setReady(false);
      setMsg(lob.note);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha");
    } finally {
      setBusy(false);
    }
  };

  const simulateMatch = async (won: boolean) => {
    if (!apiToken) return;
    setBusy(true);
    try {
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

  return (
    <div className="hub">
      <button type="button" className="pre__back" onClick={() => onNavigate("menu")}>
        ← Menu
      </button>
      <HubNav active="lobby" onNavigate={onNavigate} />
      <h1 className="hub__title">LOBBY TvT</h1>
      <div className="pre__accent" />
      <p className="hub__sub">Team vs Team · stub sem netcode / matchmaking</p>

      {!room ? (
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void create()}
        >
          Criar sala
        </button>
      ) : (
        <div className="hub__panel">
          <p className="hub__sub">
            Código <strong>{room.code}</strong> · host {room.hostCallsign || callsign}
          </p>
          <ul className="hub__list">
            {room.slots.map((s) => (
              <li key={s.seat}>
                <span>
                  Slot {s.seat}{" "}
                  {s.callsign ?? "— vazio (convite futuro)"}
                </span>
                <strong>{s.seat === 1 ? (ready ? "PRONTO" : "…") : "IA stub"}</strong>
              </li>
            ))}
          </ul>
          <div className="menu__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setReady((r) => !r)}
            >
              {ready ? "Cancelar pronto" : "Pronto"}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!ready || busy}
              onClick={() => void simulateMatch(true)}
            >
              Simular vitória
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!ready || busy}
              onClick={() => void simulateMatch(false)}
            >
              Simular derrota
            </button>
          </div>
        </div>
      )}

      {msg ? <p className="hub__empty">{msg}</p> : null}
      <p className="hub__empty">
        Netcode dedicado vem depois — rewards TvT já validam no servidor (160+30).
      </p>
    </div>
  );
}
