import { useEffect, useState } from "react";
import {
  avatarIds,
  avatarLabel,
  avatarPublicPath,
  setAvatar,
  type LocalProgress,
} from "@afd/game-core";
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
  const selectedLabel = avatarLabel(progress.avatarId);

  return (
    <div className="hub">
      <button type="button" className="pre__back" onClick={() => onNavigate("menu")}>
        ← Menu
      </button>
      <HubNav active="profile" onNavigate={onNavigate} />
      <h1 className="hub__title">PERFIL</h1>
      <div className="pre__accent" />

      <div className="profile__identity">
        <img
          className="profile__preview"
          src={avatarPublicPath(progress.avatarId)}
          alt={selectedLabel}
          width={96}
          height={96}
          draggable={false}
        />
        <div className="profile__identity-text">
          <span className="profile__pilot-tag">{selectedLabel}</span>
          <label className="pre__field profile__callsign">
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
        </div>
      </div>

      <h2 className="hub__section">Avatar</h2>
      <p className="hub__sub">Escolha o piloto · aparece no HUD em missão</p>
      <div className="profile__avatars" role="listbox" aria-label="Avatares">
        {avatarIds().map((id) => {
          const selected = id === progress.avatarId;
          const label = avatarLabel(id);
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={selected}
              title={label}
              className={
                selected
                  ? "profile__avatar-btn profile__avatar-btn--on"
                  : "profile__avatar-btn"
              }
              onClick={() => onProgress(setAvatar(progress, id))}
            >
              <img
                src={avatarPublicPath(id)}
                alt={label}
                width={56}
                height={56}
                draggable={false}
              />
              <span className="profile__avatar-label">{label}</span>
            </button>
          );
        })}
      </div>

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
