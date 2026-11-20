import { useEffect, useRef, useState } from "react";
import {
  aircraftLabel,
  avatarPublicPath,
  medalPublicPath,
  type LocalProgress,
} from "@afd/game-core";
import { MEDAL_CATALOG } from "@afd/economy";
import {
  createJetPreview,
  type JetPreviewHandle,
} from "@afd/game-render";
import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";

type Tab = "overview" | "stats" | "medals" | "history";

/** Stub until LocalProgress stores medal unlocks — show the full art set. */
const DEMO_UNLOCKED = new Set(MEDAL_CATALOG.map((m) => m.id));
const FEATURED_MEDAL_IDS = MEDAL_CATALOG.slice(0, 3).map((m) => m.id);

interface Props {
  progress: LocalProgress;
  rank: string;
  apiOnline: boolean;
  apiToken: string | null;
  dashiCoins?: number;
  onProgress: (p: LocalProgress) => void;
  onNavigate: (hub: HubId) => void;
}

export function Profile({
  progress,
  rank,
  dashiCoins = 0,
  onNavigate,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const jetCanvasRef = useRef<HTMLCanvasElement>(null);
  const jetPreviewRef = useRef<JetPreviewHandle | null>(null);
  const callsign = progress.callsign.toUpperCase();
  const avatar = avatarPublicPath(progress.avatarId);
  const acLabel = aircraftLabel(progress.aircraft);
  const xpNow = progress.xp || 12400;
  const xpNext = 20000;
  const xpPct = Math.min(100, Math.round((xpNow / xpNext) * 100));
  const lvl = Math.max(1, Math.floor(xpNow / 1000) || 14);

  useEffect(() => {
    if (tab !== "overview") {
      jetPreviewRef.current?.dispose();
      jetPreviewRef.current = null;
      return;
    }
    const canvas = jetCanvasRef.current;
    if (!canvas) return;
    const preview = createJetPreview(
      canvas,
      progress.aircraft,
      progress.skinId,
    );
    jetPreviewRef.current = preview;
    return () => {
      preview.dispose();
      if (jetPreviewRef.current === preview) jetPreviewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const preview = jetPreviewRef.current;
    if (!preview || tab !== "overview") return;
    preview.setAircraft(progress.aircraft);
    preview.setSkin(progress.skinId);
  }, [tab, progress.aircraft, progress.skinId]);

  return (
    <>
      <MenuTop
        mode="hub"
        kicker="OPERATOR"
        title="Perfil"
        credits={progress.credits}
        dashiCoins={dashiCoins}
        onBack={() => onNavigate("menu")}
        onNavigate={onNavigate}
      />

      <nav className="profile-tabs glitch-el" aria-label="Seções do perfil">
        {(
          [
            ["overview", "Visão geral"],
            ["stats", "Estatísticas"],
            ["medals", "Medals"],
            ["history", "Histórico"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`profile-tabs__item${tab === id ? " is-on" : ""}`}
            data-sfx="select"
              onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="profile-stage hub-shell hub-shell--profile">
        <div
          className={`hub-panel${tab === "overview" ? " is-on" : ""}`}
          hidden={tab !== "overview"}
        >
          <div className="profile-layout">
            <aside className="op-showcase glitch-el">
              <div className="op-showcase__frame">
                <div className="op-showcase__glow" aria-hidden="true" />
                <img
                  className="op-showcase__img"
                  src={avatar}
                  alt={`Avatar ${callsign}`}
                  decoding="async"
                />
                <div
                  className="op-showcase__rank-badge"
                  aria-label={`Nível ${lvl}`}
                >
                  <span className="op-showcase__rank-lbl">NÍVEL</span>
                  <span className="op-showcase__rank-lvl">{lvl}</span>
                </div>
              </div>

              <div className="calling-card">
                <div className="calling-card__art" aria-hidden="true" />
                <div className="calling-card__body">
                  <span className="calling-card__clan">[AFD]</span>
                  <strong className="calling-card__name">{callsign}</strong>
                  <span className="calling-card__title">
                    {rank.toUpperCase()} · Moldura Steel
                  </span>
                </div>
                <div className="calling-card__emblem" aria-hidden="true">
                  {callsign.charAt(0) || "V"}
                </div>
              </div>

              <div className="op-xp">
                <div className="op-xp__row">
                  <span>Patente</span>
                  <span>
                    {xpNow.toLocaleString("pt-BR")} /{" "}
                    {xpNext.toLocaleString("pt-BR")} XP
                  </span>
                </div>
                <div className="meter meter--stripe meter--xp-anim">
                  <div className="meter__fill" style={{ width: `${xpPct}%` }} />
                </div>
                <p className="op-xp__next">Próximo: MAJOR</p>
              </div>
            </aside>

            <section className="op-intel">
              <header className="op-intel__head glitch-el">
                <div>
                  <p className="op-intel__kicker">PILOTO ATIVO</p>
                  <h2 className="op-intel__name">{callsign}</h2>
                  <p className="op-intel__sub">
                    Lake Country · last light · sessão #186
                  </p>
                </div>
                <div className="op-intel__wallet">
                  <div className="op-wallet">
                    <span>Credits</span>
                    <strong>{progress.credits.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div className="op-wallet">
                    <span>Dashi Coins</span>
                    <strong>{dashiCoins.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div className="op-wallet">
                    <span>Medals</span>
                    <strong>6</strong>
                  </div>
                </div>
              </header>

              <div className="stat-tiles glitch-el">
                <article className="stat-tile">
                  <span className="stat-tile__label">Partidas</span>
                  <strong className="stat-tile__value">186</strong>
                  <span className="stat-tile__hint">+12 esta semana</span>
                </article>
                <article className="stat-tile">
                  <span className="stat-tile__label">Clear rate</span>
                  <strong className="stat-tile__value">71%</strong>
                  <span className="stat-tile__hint">132 clears</span>
                </article>
                <article className="stat-tile">
                  <span className="stat-tile__label">Tempo de voo</span>
                  <strong className="stat-tile__value">42h</strong>
                  <span className="stat-tile__hint">18h Checkpoint</span>
                </article>
                <article className="stat-tile">
                  <span className="stat-tile__label">Melhor tempo</span>
                  <strong className="stat-tile__value">0:51</strong>
                  <span className="stat-tile__hint">CP · solo</span>
                </article>
              </div>

              <div className="op-featured">
                <article className="featured-ac glitch-el">
                  <p className="pre-col__label">Aeronave principal</p>
                  <div className="featured-ac__card">
                    <div className="featured-ac__stage">
                      <canvas
                        ref={jetCanvasRef}
                        className="featured-ac__canvas"
                        aria-label={`Miniatura 3D ${acLabel}`}
                      />
                    </div>
                    <div className="featured-ac__meta">
                      <h3 className="featured-ac__name">{acLabel}</h3>
                      <p className="featured-ac__line">
                        Skin{" "}
                        {progress.skinId === "factory"
                          ? "Default"
                          : progress.skinId}{" "}
                        · Emblem {progress.emblemId} ·{" "}
                        {progress.effectId === "trail_off"
                          ? "Trail off"
                          : progress.effectId}
                      </p>
                      <div className="featured-ac__tags">
                        <span className="tag tag--ok">ACTIVE</span>
                        <span className="tag">Mastery Lv 4</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        data-sfx="select"
                        onClick={() => onNavigate("hangar")}
                      >
                        Abrir Hangar
                      </button>
                    </div>
                  </div>
                </article>

                <article className="featured-medals glitch-el">
                  <p className="pre-col__label">Vitrine · Medals</p>
                  <div className="medal-wall">
                    {FEATURED_MEDAL_IDS.map((id, i) => {
                      const medal = MEDAL_CATALOG.find((m) => m.id === id)!;
                      return (
                        <button
                          key={medal.id}
                          type="button"
                          className={`medal-card${i === 0 ? " is-on" : ""}`}
                          data-sfx="select"
                          title={medal.description}
                        >
                          <img
                            className="medal-card__art"
                            src={medalPublicPath(medal.id)}
                            alt=""
                            width={64}
                            height={64}
                            decoding="async"
                          />
                          <span className="medal-card__name">{medal.name}</span>
                          <span className="medal-card__meta">{medal.description}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="medal-card medal-card--empty"
                      disabled
                      data-sfx="deny"
                    >
                      <span className="medal-card__icon">+</span>
                      <span className="medal-card__name">SLOT</span>
                      <span className="medal-card__meta">Locked</span>
                    </button>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>

        <div
          className={`hub-panel${tab === "stats" ? " is-on" : ""}`}
          hidden={tab !== "stats"}
        >
          <div className="profile-stats-grid glitch-el">
            <div className="panel panel--pad">
              <div className="header-bar">
                <span>POR MODO</span>
              </div>
              <ul className="hub__list">
                <li>
                  <span>Checkpoint</span>
                  <strong>98 · 0:51 best</strong>
                </li>
                <li>
                  <span>Anti-Drone</span>
                  <strong>54 · 2.480 top</strong>
                </li>
                <li>
                  <span>Voo Livre</span>
                  <strong>22 · 6.4h</strong>
                </li>
                <li>
                  <span>Missões</span>
                  <strong>12 clears</strong>
                </li>
              </ul>
            </div>
            <div className="panel panel--pad">
              <div className="header-bar">
                <span>COMBATE</span>
              </div>
              <ul className="hub__list">
                <li>
                  <span>Kills (AD)</span>
                  <strong>1.842</strong>
                </li>
                <li>
                  <span>Streak máx.</span>
                  <strong>14</strong>
                </li>
                <li>
                  <span>Missiles fired</span>
                  <strong>3.210</strong>
                </li>
                <li>
                  <span>Colisões</span>
                  <strong>41</strong>
                </li>
              </ul>
            </div>
            <div className="panel panel--pad">
              <div className="header-bar">
                <span>PROGRESSÃO</span>
              </div>
              <ul className="hub__list">
                <li>
                  <span>Patente</span>
                  <strong>{rank}</strong>
                </li>
                <li>
                  <span>Mastery F-22</span>
                  <strong>Lv 4</strong>
                </li>
                <li>
                  <span>BP tier</span>
                  <strong>7 FREE</strong>
                </li>
                <li>
                  <span>Daily streak</span>
                  <strong>4 dias</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div
          className={`hub-panel${tab === "medals" ? " is-on" : ""}`}
          hidden={tab !== "medals"}
        >
          <p className="pre-col__label glitch-el">
            Coleção · {DEMO_UNLOCKED.size} / {MEDAL_CATALOG.length}
          </p>
          <div className="medal-wall medal-wall--wide glitch-el">
            {MEDAL_CATALOG.map((medal, i) => {
              const locked = !DEMO_UNLOCKED.has(medal.id);
              return (
                <button
                  key={medal.id}
                  type="button"
                  className={`medal-card${locked ? " medal-card--empty" : i === 0 ? " is-on" : ""}`}
                  disabled={locked}
                  data-sfx={locked ? "deny" : "select"}
                  title={medal.description}
                >
                  <img
                    className="medal-card__art"
                    src={medalPublicPath(medal.id)}
                    alt=""
                    width={72}
                    height={72}
                    decoding="async"
                  />
                  <span className="medal-card__name">{medal.name}</span>
                  <span className="medal-card__meta">
                    {locked ? "Locked" : medal.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`hub-panel${tab === "history" ? " is-on" : ""}`}
          hidden={tab !== "history"}
        >
          <div className="panel panel--pad glitch-el">
            <div className="header-bar">
              <span>ÚLTIMAS PARTIDAS</span>
            </div>
            <ul className="history-list">
              <li>
                <span className="history-list__mode">CHECKPOINT</span>
                <span className="history-list__result tag tag--ok">CLEAR</span>
                <span>0:54.2</span>
                <strong>+180 CR</strong>
              </li>
              <li>
                <span className="history-list__mode">ANTI-DRONE</span>
                <span className="history-list__result tag tag--ok">CLEAR</span>
                <span>2.110</span>
                <strong>+220 CR</strong>
              </li>
              <li>
                <span className="history-list__mode">CHECKPOINT</span>
                <span className="history-list__result tag tag--warn">FAIL</span>
                <span>—</span>
                <strong>+0 CR</strong>
              </li>
              <li>
                <span className="history-list__mode">VOO LIVRE</span>
                <span className="history-list__result tag">SANDBOX</span>
                <span>12 min</span>
                <strong>—</strong>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
