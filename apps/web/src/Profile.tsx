import { useEffect, useState } from "react";
import type { LocalProgress } from "@afd/game-core";
import { Aircraft } from "@afd/shared-types";
import { fetchMedals, type MedalRow } from "./api/economyClient";
import { HubNav, type HubId } from "./HubNav";

interface Props {
  progress: LocalProgress;
  rank: string;
  apiOnline: boolean;
  apiToken: string | null;
  onProgress: (p: LocalProgress) => void;
  onNavigate: (hub: HubId) => void;
}

export function Profile({
  progress,
  rank,
  apiOnline,
  apiToken,
  onProgress,
  onNavigate,
}: Props) {
  const [medals, setMedals] = useState<MedalRow[]>([]);

  useEffect(() => {
    if (!apiToken) {
      setMedals([]);
      return;
    }
    let cancelled = false;
    fetchMedals(apiToken)
      .then((list) => {
        if (!cancelled) setMedals(list);
      })
      .catch(() => {
        if (!cancelled) setMedals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [apiToken]);

  const unlocked = medals.filter((m) => m.unlocked);

  return (
    <div className="hub">
      <button type="button" className="pre__back" onClick={() => onNavigate("menu")}>
        ← Menu
      </button>
      <HubNav active="profile" onNavigate={onNavigate} />
      <h1 className="hub__title">PERFIL</h1>
      <div className="pre__accent" />

      <label className="pre__field">
        Callsign
        <input
          value={progress.callsign}
          maxLength={16}
          onChange={(e) =>
            onProgress({
              ...progress,
              callsign: e.target.value.toUpperCase(),
            })
          }
        />
      </label>

      <ul className="hub__list">
        <li>
          Patente <strong>{rank}</strong>
        </li>
        <li>
          Aeronave{" "}
          <strong>
            {progress.aircraft === Aircraft.F15_EAGLE ? "F-15" : "F-22"}
          </strong>
        </li>
        <li>
          Frota <strong>{progress.ownedAircraft.length}</strong>
        </li>
        <li>
          Credits <strong>{progress.credits.toLocaleString("pt-BR")}</strong>
        </li>
        <li>
          XP <strong>{progress.xp}</strong>
        </li>
        <li>
          Wallet <strong>{apiOnline ? "API" : "local cache"}</strong>
        </li>
      </ul>

      <h2 className="hub__section">Medals</h2>
      <p className="hub__sub">
        Conquistas · {unlocked.length}/{medals.length || "—"} · não compráveis
      </p>
      {!apiToken ? (
        <p className="hub__empty">Conecte a API para sincronizar medals.</p>
      ) : medals.length === 0 ? (
        <p className="hub__empty">Carregando vitrine…</p>
      ) : (
        <div className="medals__grid">
          {medals.map((m) => (
            <div
              key={m.id}
              className={m.unlocked ? "medals__card medals__card--on" : "medals__card"}
              title={m.description}
            >
              <span className="medals__name">{m.name}</span>
              <span className="medals__meta">
                {m.unlocked ? "desbloqueada" : "bloqueada"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
