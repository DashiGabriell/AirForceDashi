import { useCallback, useEffect, useState } from "react";
import type { LocalProgress } from "@afd/game-core";
import {
  claimOperationApi,
  claimSeasonReward,
  fetchLeaderboard,
  fetchOperations,
  fetchSeason,
  stubBuyPass,
  type LeaderboardEntry,
  type OperationRow,
  type SeasonSnapshot,
} from "./api/economyClient";
import { HubNav } from "./HubNav";

type Tab = "ops" | "rank" | "board" | "season";

interface Props {
  progress: LocalProgress;
  rank?: string;
  apiToken: string | null;
  initialTab?: Tab;
  onProgress: (p: LocalProgress) => void;
  onDashiCoins?: (n: number) => void;
  onNavigate: (
    hub: "menu" | "hangar" | "career" | "shop" | "profile" | "settings" | "lobby",
  ) => void;
}

export function Career({
  progress,
  rank = "Cadete",
  apiToken,
  initialTab = "ops",
  onProgress,
  onDashiCoins,
  onNavigate,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [ops, setOps] = useState<OperationRow[]>([]);
  const [boardMode, setBoardMode] = useState<"checkpoint" | "antidrone">("checkpoint");
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [season, setSeason] = useState<SeasonSnapshot | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const reloadOps = useCallback(async () => {
    if (!apiToken) {
      setOps([]);
      return;
    }
    try {
      const data = await fetchOperations(apiToken);
      setOps(data.operations);
    } catch {
      setMsg("Operações indisponíveis (API offline)");
    }
  }, [apiToken]);

  const reloadSeason = useCallback(async () => {
    if (!apiToken) {
      setSeason(null);
      return;
    }
    try {
      setSeason(await fetchSeason(apiToken));
    } catch {
      setMsg("Temporada indisponível");
    }
  }, [apiToken]);

  useEffect(() => {
    void reloadOps();
  }, [reloadOps]);

  useEffect(() => {
    if (tab === "season") void reloadSeason();
  }, [tab, reloadSeason]);

  useEffect(() => {
    if (tab !== "board") return;
    let cancelled = false;
    fetchLeaderboard(boardMode)
      .then((entries) => {
        if (!cancelled) setBoard(entries);
      })
      .catch(() => {
        if (!cancelled) setBoard([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, boardMode]);

  const claim = async (op: OperationRow) => {
    if (!apiToken || !op.claimable) return;
    try {
      const res = await claimOperationApi(apiToken, op.id);
      setOps(res.operations);
      onProgress({
        ...progress,
        credits: res.wallet.credits,
        xp: progress.xp + res.xp,
      });
      setMsg(`+${res.credited} Credits · +${res.xp} XP`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha no claim");
    }
  };

  const claimBp = async (level: number, track: "free" | "premium") => {
    if (!apiToken) return;
    try {
      const res = await claimSeasonReward(apiToken, level, track);
      setSeason(res.season);
      onProgress({ ...progress, credits: res.wallet.credits });
      onDashiCoins?.(res.wallet.dashiCoins);
      setMsg(`Claim L${level} ${track}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha");
    }
  };

  const buyPass = async (offerId: string) => {
    if (!apiToken) return;
    try {
      const res = await stubBuyPass(apiToken, offerId);
      setSeason(res.season);
      setMsg("Premium Pass ativo (stub)");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha");
    }
  };

  const daily = ops.filter((o) => o.kind === "daily");
  const weekly = ops.filter((o) => o.kind === "weekly");
  const resetHint = daily[0]?.resetsAt
    ? `Daily reset ${new Date(daily[0].resetsAt).toUTCString()}`
    : null;

  const claimableRewards =
    season?.rewards.filter((r) => r.claimable).slice(0, 12) ?? [];

  return (
    <div className="hub">
      <button type="button" className="pre__back" onClick={() => onNavigate("menu")}>
        ← Menu
      </button>
      <HubNav active="career" onNavigate={onNavigate} />
      <h1 className="hub__title">CARREIRA</h1>
      <div className="pre__accent" />

      <div className="hub__tabs" role="tablist" aria-label="Carreira">
        {(
          [
            ["ops", "Operações"],
            ["season", "Temporada"],
            ["rank", "Patente"],
            ["board", "Ranking"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "hub__tab hub__tab--on" : "hub__tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "ops" ? (
        <div className="hub__panel">
          <p className="hub__sub">
            Daily + Weekly · validação server
            {resetHint ? ` · ${resetHint}` : ""}
          </p>
          {!apiToken ? (
            <p className="hub__empty">Inicie a API (`npm run api`) para operações.</p>
          ) : (
            <>
              <h2 className="hub__section">Daily</h2>
              <ul className="hub__list">
                {daily.map((op) => (
                  <li key={op.id}>
                    <span>
                      {op.title}
                      <br />
                      <small>
                        {op.isBonus
                          ? op.complete
                            ? "pronto"
                            : "bloqueado"
                          : `${op.progress}/${op.target}`}{" "}
                        · {op.rewardCredits} Cr
                      </small>
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--tiny"
                      disabled={!op.claimable}
                      onClick={() => void claim(op)}
                    >
                      {op.claimed ? "OK" : op.claimable ? "Claim" : "—"}
                    </button>
                  </li>
                ))}
              </ul>
              <h2 className="hub__section">Weekly</h2>
              <ul className="hub__list">
                {weekly.map((op) => (
                  <li key={op.id}>
                    <span>
                      {op.title}
                      <br />
                      <small>
                        {op.isBonus
                          ? op.complete
                            ? "pronto"
                            : "bloqueado"
                          : `${op.progress}/${op.target}`}{" "}
                        · {op.rewardCredits} Cr
                      </small>
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--tiny"
                      disabled={!op.claimable}
                      onClick={() => void claim(op)}
                    >
                      {op.claimed ? "OK" : op.claimable ? "Claim" : "—"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      {tab === "season" ? (
        <div className="hub__panel">
          {!apiToken || !season ? (
            <p className="hub__empty">API offline — Battle Pass server-side.</p>
          ) : (
            <>
              <p className="hub__sub">
                {season.seasonId} · Nv {season.level}/{season.maxLevel} · XP{" "}
                {season.xp}
                {season.hasPremium ? " · Premium" : " · Free"}
              </p>
              <p className="hub__sub">
                Termina {new Date(season.endsAt).toLocaleDateString("pt-BR")}
              </p>
              {!season.hasPremium ? (
                <div className="shop__grid">
                  {season.offers.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="hangar__card"
                      onClick={() => void buyPass(o.id)}
                    >
                      <span className="hangar__name">{o.name}</span>
                      <span className="hangar__meta">
                        R$ {o.priceBrl.toFixed(2).replace(".", ",")} stub
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <h2 className="hub__section">Recompensas claimáveis</h2>
              {claimableRewards.length === 0 ? (
                <p className="hub__empty">Jogue partidas para subir XP de temporada.</p>
              ) : (
                <ul className="hub__list">
                  {claimableRewards.map((r) => (
                    <li key={`${r.track}-${r.level}`}>
                      <span>
                        L{r.level} {r.track}
                        <br />
                        <small>{r.label}</small>
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--tiny"
                        onClick={() => void claimBp(r.level, r.track)}
                      >
                        Claim
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === "rank" ? (
        <div className="hub__panel">
          <p className="hub__sub">XP · patente · progressão</p>
          <ul className="hub__list">
            <li>
              Patente <strong>{rank}</strong>
            </li>
            <li>
              XP <strong>{progress.xp}</strong>
            </li>
            <li>
              CheckPoint unlocked <strong>{progress.cpUnlocked}</strong>
            </li>
            <li>
              Anti-Drone unlocked <strong>{progress.adUnlocked}</strong>
            </li>
            <li>
              Ataque unlocked <strong>{progress.atUnlocked}</strong>
            </li>
          </ul>
        </div>
      ) : null}

      {tab === "board" ? (
        <div className="hub__panel">
          <p className="hub__sub">Solo por modo · escrita só via grant validado</p>
          <div className="hub__tabs hub__tabs--sub">
            <button
              type="button"
              className={
                boardMode === "checkpoint" ? "hub__tab hub__tab--on" : "hub__tab"
              }
              onClick={() => setBoardMode("checkpoint")}
            >
              CheckPoint
            </button>
            <button
              type="button"
              className={
                boardMode === "antidrone" ? "hub__tab hub__tab--on" : "hub__tab"
              }
              onClick={() => setBoardMode("antidrone")}
            >
              Anti-Drone
            </button>
          </div>
          {board.length === 0 ? (
            <p className="hub__empty">Sem scores ainda — jogue uma missão.</p>
          ) : (
            <ul className="hub__list">
              {board.map((e) => (
                <li key={`${e.playerId}-${e.rank}`}>
                  <span>
                    #{e.rank} {e.callsign}
                  </span>
                  <strong>{e.score}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {msg ? <p className="hub__empty">{msg}</p> : null}
    </div>
  );
}
