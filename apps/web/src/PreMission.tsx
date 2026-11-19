import { useState } from "react";
import {
  AD_LEVEL_COUNT,
  AT_LEVEL_COUNT,
  CP_LEVEL_COUNT,
  F15_UNLOCK_COST,
  antidroneDef,
  attackDef,
  checkpointDef,
  type LocalProgress,
} from "@afd/game-core";
import { Aircraft, PlayMode } from "@afd/shared-types";
import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";

export interface MissionLaunch {
  playMode: PlayMode;
  level: number;
  aircraft: Aircraft;
  callsign: string;
}

type ModeId = "cp" | "ad" | "aa" | "atk" | "tvt" | "free";

interface Props {
  progress: LocalProgress;
  onProgress: (p: LocalProgress) => void;
  credits?: number;
  dashiCoins?: number;
  rank?: string;
  pilotLevel?: number;
  onLaunch: (launch: MissionLaunch) => void;
  onBack: () => void;
  onNavigate?: (hub: HubId) => void;
  onFreeFlight?: () => void;
}

const MODES: Array<{
  id: ModeId;
  name: string;
  meta: string;
  reward: string;
  kind: "light" | "mid";
  weight: string;
  line: string;
}> = [
  {
    id: "cp",
    name: "Checkpoint",
    meta: "Arcade · leve",
    reward: "+120–420",
    kind: "light",
    weight: "LEVE",
    line: "Passe pelos anéis antes do tempo zerar.",
  },
  {
    id: "ad",
    name: "Anti-Drone",
    meta: "Arcade · leve",
    reward: "+150–500",
    kind: "light",
    weight: "LEVE",
    line: "Derrube drones antes que vazem pela linha.",
  },
  {
    id: "aa",
    name: "Defesa aérea",
    meta: "Missão · médio",
    reward: "+200–600",
    kind: "mid",
    weight: "MÉDIO",
    line: "Neutralizar 8 alvos aéreos",
  },
  {
    id: "atk",
    name: "Ataque",
    meta: "Missão · médio",
    reward: "+220–650",
    kind: "mid",
    weight: "MÉDIO",
    line: "Destruir alvos no solo",
  },
  {
    id: "tvt",
    name: "Team vs Team",
    meta: "Lobby · expansão",
    reward: "servidor",
    kind: "mid",
    weight: "MÉDIO",
    line: "Lobby stub 4v4",
  },
  {
    id: "free",
    name: "Voo Livre",
    meta: "Sandbox · leve",
    reward: "—",
    kind: "light",
    weight: "LEVE",
    line: "Explore o mapa sem ranking nem timer.",
  },
];

export function PreMission({
  progress,
  onProgress,
  credits,
  dashiCoins = 0,
  rank = "Cadete",
  pilotLevel = 1,
  onLaunch,
  onBack,
  onNavigate,
  onFreeFlight,
}: Props) {
  const [mode, setMode] = useState<ModeId>("cp");
  const [level, setLevel] = useState(1);

  const unlocked =
    mode === "cp"
      ? progress.cpUnlocked
      : mode === "ad"
        ? progress.adUnlocked
        : mode === "atk" || mode === "aa"
          ? progress.atUnlocked
          : 1;
  const max =
    mode === "cp"
      ? CP_LEVEL_COUNT
      : mode === "ad"
        ? AD_LEVEL_COUNT
        : mode === "atk" || mode === "aa"
          ? AT_LEVEL_COUNT
          : 1;
  const safeLevel = Math.min(level, Math.max(1, unlocked));
  const def =
    mode === "cp"
      ? checkpointDef(safeLevel)
      : mode === "ad"
        ? antidroneDef(safeLevel)
        : mode === "atk" || mode === "aa"
          ? attackDef(safeLevel)
          : null;

  const modeMeta = MODES.find((m) => m.id === mode)!;
  const ownsF15 = progress.ownedAircraft.includes(Aircraft.F15_EAGLE);
  const acLabel =
    progress.aircraft === Aircraft.F15_EAGLE ? "F-15 EAGLE" : "F-22 RAPTOR";

  const play = () => {
    if (mode === "free") {
      onFreeFlight?.();
      return;
    }
    if (mode === "tvt") {
      onNavigate?.("lobby");
      return;
    }
    const playMode =
      mode === "cp"
        ? PlayMode.CHECKPOINT
        : mode === "ad"
          ? PlayMode.ANTI_DRONE
          : PlayMode.ATTACK;
    onLaunch({
      playMode,
      level: safeLevel,
      aircraft: progress.aircraft,
      callsign: progress.callsign || "DASHI-1",
    });
  };

  return (
    <>
      <MenuTop
        mode="hub"
        kicker="MULTI"
        title="Pré-partida"
        credits={credits ?? progress.credits}
        dashiCoins={dashiCoins}
        callsign={progress.callsign}
        rank={rank}
        level={pilotLevel}
        avatarId={progress.avatarId}
        showPilot
        onBack={onBack}
        {...(onNavigate ? { onNavigate } : {})}
      />

      <main className="pre-shell">
        <section className="pre-playlist" aria-label="Modos">
          <p className="pre-col__label glitch-el">1 · Escolha o modo</p>
          <div className="playlist" role="listbox" aria-label="Playlist">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`playlist__item glitch-el${mode === m.id ? " is-on" : ""}`}
                role="option"
                aria-selected={mode === m.id}
                data-sfx="select"
              onClick={() => {
                  setMode(m.id);
                  setLevel(1);
                }}
              >
                <span className="playlist__bar" aria-hidden="true" />
                <span className="playlist__body">
                  <span className="playlist__name">{m.name}</span>
                  <span className="playlist__meta">{m.meta}</span>
                </span>
                <span className="playlist__reward">{m.reward}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="pre-detail glitch-el" aria-label="Briefing">
          <p className="pre-col__label">3 · Briefing</p>
          <div className="pre-detail__panel">
            <div className="header-bar header-bar--fill">
              <span>{modeMeta.name.toUpperCase()}</span>
            </div>

            {modeMeta.kind === "light" ? (
              <div className="brief brief--light">
                <p className="brief__kind">
                  LEVE · {modeMeta.name}
                </p>
                <p className="brief__line">{modeMeta.line}</p>
                <p className="brief__meta">
                  {mode === "free"
                    ? `${acLabel} · sandbox`
                    : `Lv ${safeLevel} · ${acLabel} · ${modeMeta.reward} CR base`}
                </p>
              </div>
            ) : (
              <div className="brief brief--mid">
                <p className="brief__kind">MÉDIO · {modeMeta.name}</p>
                <ul className="brief__goals">
                  <li>
                    <strong>Primário</strong> —{" "}
                    {mode === "aa"
                      ? "Neutralizar 8 alvos aéreos"
                      : mode === "tvt"
                        ? "Lobby stub 4v4"
                        : mode === "atk" && def
                          ? `Destruir ${(def as ReturnType<typeof attackDef>).targetCount} alvos`
                          : modeMeta.line}
                  </li>
                  <li>
                    <strong>Secundário</strong> — Sem colisão com solo
                  </li>
                </ul>
                <p className="brief__meta">
                  Cenário: Lake Country · dusk · {modeMeta.reward} CR
                </p>
              </div>
            )}

            <div className="pre-detail__stats">
              <div className="pre-stat">
                <span>Recompensa</span>
                <strong>
                  {modeMeta.reward === "—" || modeMeta.reward === "servidor"
                    ? modeMeta.reward
                    : `${modeMeta.reward} CR`}
                </strong>
              </div>
              <div className="pre-stat">
                <span>Peso</span>
                <strong>{modeMeta.weight}</strong>
              </div>
              <div className="pre-stat">
                <span>Cenário</span>
                <strong>Lake Country</strong>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="pre-dock">
        <div className="pre-dock__ac">
          <p className="pre-col__label">2 · Aeronave</p>
          <div className="pre-ac-row" role="listbox" aria-label="Aeronave">
            <button
              type="button"
              className={`hangar__card glitch-el${
                progress.aircraft === Aircraft.F22_RAPTOR
                  ? " hangar__card--on"
                  : ""
              }`}
              data-sfx="select"
              onClick={() => onProgress({ ...progress, aircraft: Aircraft.F22_RAPTOR })
              }
            >
              <span className="hangar__name">F-22 RAPTOR</span>
              <span className="hangar__meta">
                {progress.aircraft === Aircraft.F22_RAPTOR
                  ? "Equipada"
                  : "Owned"}
              </span>
              <span className="tag tag--ok">READY</span>
            </button>
            <button
              type="button"
              className={`hangar__card glitch-el${
                progress.aircraft === Aircraft.F15_EAGLE
                  ? " hangar__card--on"
                  : ""
              }${ownsF15 ? "" : " hangar__card--locked"}`}
              disabled={!ownsF15}
              data-sfx={ownsF15 ? "select" : "deny"}
              onClick={() =>
                ownsF15 &&
                onProgress({ ...progress, aircraft: Aircraft.F15_EAGLE })
              }
            >
              <span className="hangar__name">F-15 EAGLE</span>
              <span className="hangar__meta">
                {ownsF15
                  ? "Owned"
                  : `Meta · ${F15_UNLOCK_COST.toLocaleString("pt-BR")} CR`}
              </span>
              <span className={`tag ${ownsF15 ? "tag--ok" : "tag--warn"}`}>
                {ownsF15 ? "READY" : "LOCKED"}
              </span>
            </button>
          </div>
        </div>

        <div className="pre-dock__cta">
          <p className="pre-dock__summary">
            <span>{modeMeta.name.toUpperCase()}</span>
            {" · "}
            <span>{acLabel}</span>
          </p>
          <button
            type="button"
            className="btn btn--primary pre-play glitch-el"
            data-sfx="confirm"
            onClick={play}
          >
            Play
          </button>
        </div>
      </footer>
    </>
  );
}
