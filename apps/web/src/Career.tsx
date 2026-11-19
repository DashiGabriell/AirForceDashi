import { useCallback, useEffect, useState } from "react";
import type { LocalProgress } from "@afd/game-core";
import {
  claimOperationApi,
  fetchLeaderboard,
  fetchOperations,
  fetchSeason,
  stubBuyPass,
  type LeaderboardEntry,
  type OperationRow,
  type SeasonSnapshot,
} from "./api/economyClient";
import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";

type Tab = "ops" | "rank" | "season" | "board" | "events";

interface Props {
  progress: LocalProgress;
  rank?: string;
  dashiCoins?: number;
  apiToken: string | null;
  initialTab?: Tab;
  onProgress: (p: LocalProgress) => void;
  onDashiCoins?: (n: number) => void;
  onNavigate: (hub: HubId) => void;
}

const DAILY_ROWS = [
  { label: "3 checkpoints clear", reward: "+80 CR" },
  { label: "1 Anti-Drone ≥ 2k", reward: "+120 CR" },
  { label: "Voar 5 min", reward: "+40 CR" },
  { label: "Bônus 3/3", reward: "+100 CR" },
] as const;

const WEEKLY_ROWS = [
  { label: "12 missões", reward: "+400 CR" },
  { label: "Mastery +2 níveis", reward: "skin chip" },
] as const;

const BOARD_STATIC = [
  { pos: "01", name: "ACE-9", score: "0:48.2" },
  { pos: "02", name: "VIPER-1", score: "0:51.0" },
  { pos: "03", name: "GHOST", score: "0:53.4" },
  { pos: "04", name: "NOVA", score: "0:55.1" },
  { pos: "05", name: "REX", score: "0:56.8" },
] as const;

export function Career({
  progress,
  rank = "Cadete",
  dashiCoins = 0,
  apiToken,
  initialTab = "ops",
  onProgress,
  onNavigate,
}: Props) {
  const [tab, setTab] = useState<Tab>(
    initialTab === "season" ? "season" : initialTab,
  );
  const [ops, setOps] = useState<OperationRow[]>([]);
  const [boardMode, setBoardMode] = useState<"checkpoint" | "antidrone">(
    "checkpoint",
  );
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
      /* mock visual remains */
    }
  }, [apiToken]);

  useEffect(() => {
    void reloadOps();
  }, [reloadOps]);

  useEffect(() => {
    if (tab !== "season" || !apiToken) return;
    fetchSeason(apiToken)
      .then(setSeason)
      .catch(() => setSeason(null));
  }, [tab, apiToken]);

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

  const claimFirstReady = async () => {
    const ready = ops.find((o) => o.claimable);
    if (!apiToken || !ready) return;
    try {
      const res = await claimOperationApi(apiToken, ready.id);
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

  const buyPass = async () => {
    if (!apiToken || !season?.offers[0]) {
      onNavigate("shop");
      return;
    }
    try {
      await stubBuyPass(apiToken, season.offers[0].id);
      setMsg("Premium Pass ativo (stub)");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha");
    }
  };

  const rankTitle = rank.toUpperCase();
  const xpNow = progress.xp || 12400;
  const xpNext = 20000;
  const xpPct = Math.min(100, Math.round((xpNow / xpNext) * 100));

  const boardRows =
    board.length > 0
      ? board.slice(0, 5).map((e, i) => ({
          pos: String(i + 1).padStart(2, "0"),
          name: e.callsign,
          score:
            boardMode === "checkpoint"
              ? String(e.score)
              : String(e.score),
        }))
      : BOARD_STATIC;

  return (
    <>
      <MenuTop
        mode="hub"
        kicker="OPS"
        title="Carreira"
        credits={progress.credits}
        dashiCoins={dashiCoins}
        onBack={() => onNavigate("menu")}
        onNavigate={onNavigate}
      />

      <main className="hub-shell">
        <nav className="hub-side" aria-label="Carreira">
          {(
            [
              ["ops", "Operações"],
              ["rank", "Patente"],
              ["season", "Temporada"],
              ["board", "Ranking"],
              ["events", "Eventos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`hub-side__item${tab === id ? " is-on" : ""}`}
              data-sfx="select"
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="hub-main">
          <div
            className={`hub-panel${tab === "ops" ? " is-on" : ""}`}
            hidden={tab !== "ops"}
          >
            <div className="ops-row">
              <div
                className="ops-card panel panel--pad"
                onClick={() => void claimFirstReady()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void claimFirstReady();
                }}
                role="presentation"
              >
                <div className="ops-card__head">
                  <span className="header-bar">DAILY</span>
                  <span className="ops-card__cd" data-countdown="daily">
                    05:12:44
                  </span>
                </div>
                <ul className="hub__list">
                  {DAILY_ROWS.map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.reward}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="ops-card panel panel--pad">
                <div className="ops-card__head">
                  <span className="header-bar">WEEKLY</span>
                  <span className="ops-card__cd" data-countdown="weekly">
                    2d 11h
                  </span>
                </div>
                <ul className="hub__list">
                  {WEEKLY_ROWS.map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.reward}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div
            className={`hub-panel${tab === "rank" ? " is-on" : ""}`}
            hidden={tab !== "rank"}
          >
            <div className="panel panel--pad">
              <p className="title">PATENTE · {rankTitle}</p>
              <div className="meter meter--solid" style={{ margin: "12px 0" }}>
                <div className="meter__fill" style={{ width: `${xpPct}%` }} />
              </div>
              <p className="meta">
                XP {xpNow.toLocaleString("pt-BR")} /{" "}
                {xpNext.toLocaleString("pt-BR")} · próximo: MAJOR
              </p>
            </div>
          </div>

          <div
            className={`hub-panel${tab === "season" ? " is-on" : ""}`}
            hidden={tab !== "season"}
          >
            <p className="hub__sub">Battle Pass · Free / Premium · 8 semanas</p>
            <div className="bp-tracks">
              <div className="bp-track">
                <div className="bp-track__label">FREE</div>
                <div className="bp-nodes">
                  <span className="bp-node bp-node--on">1</span>
                  <span className="bp-node bp-node--on">2</span>
                  <span className="bp-node bp-node--on">3</span>
                  <span className="bp-node">4</span>
                  <span className="bp-node">5</span>
                  <span className="bp-node">…</span>
                  <span className="bp-node">40</span>
                </div>
              </div>
              <div className="bp-track bp-track--prem">
                <div className="bp-track__label">PREMIUM</div>
                <div className="bp-nodes">
                  <span className="bp-node bp-node--hot">1</span>
                  <span className="bp-node bp-node--hot">2</span>
                  <span className="bp-node">3</span>
                  <span className="bp-node">4</span>
                  <span className="bp-node">5</span>
                  <span className="bp-node">…</span>
                  <span className="bp-node">40</span>
                </div>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn btn--primary"
                data-sfx="confirm"
              onClick={() => void buyPass()}
              >
                Premium Pass · R$ 24,90
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                data-sfx="select"
              onClick={() => onNavigate("shop")}
              >
                Loja Premium
              </button>
            </div>
          </div>

          <div
            className={`hub-panel${tab === "board" ? " is-on" : ""}`}
            hidden={tab !== "board"}
          >
            <div className="hub__tabs" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className={`hub__tab${
                  boardMode === "checkpoint" ? " hub__tab--on" : ""
                }`}
                data-sfx="select"
              onClick={() => setBoardMode("checkpoint")}
              >
                Checkpoint time
              </button>
              <button
                type="button"
                className={`hub__tab${
                  boardMode === "antidrone" ? " hub__tab--on" : ""
                }`}
                data-sfx="select"
              onClick={() => setBoardMode("antidrone")}
              >
                Anti-Drone score
              </button>
            </div>
            <ol className="leaderboard">
              {boardRows.map((row) => (
                <li key={`${row.pos}-${row.name}`}>
                  <span className="leaderboard__pos">{row.pos}</span>
                  <span>{row.name}</span>
                  <strong>{row.score}</strong>
                </li>
              ))}
            </ol>
          </div>

          <div
            className={`hub-panel${tab === "events" ? " is-on" : ""}`}
            hidden={tab !== "events"}
          >
            <div className="panel panel--pad">
              <div className="header-bar header-bar--fill">
                <span>SPECIAL OPS</span>
              </div>
              <p className="body">
                Operação noturna · skin exclusiva · janela 7 dias.
              </p>
              <p className="meta">Fase 10 · quando ativa</p>
            </div>
          </div>

          {msg ? <p className="hub__empty">{msg}</p> : null}
        </section>
      </main>
    </>
  );
}
