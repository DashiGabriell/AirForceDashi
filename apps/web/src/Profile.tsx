import { avatarPublicPath, type LocalProgress } from "@afd/game-core";
import { Aircraft } from "@afd/shared-types";
import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";
import { useState } from "react";

type Tab = "overview" | "stats" | "medals" | "history";

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
  const callsign = progress.callsign.toUpperCase();
  const avatar = avatarPublicPath(progress.avatarId);
  const acLabel =
    progress.aircraft === Aircraft.F15_EAGLE ? "F-15 EAGLE" : "F-22 RAPTOR";
  const xpNow = progress.xp || 12400;
  const xpNext = 20000;
  const xpPct = Math.min(100, Math.round((xpNow / xpNext) * 100));
  const lvl = Math.max(1, Math.floor(xpNow / 1000) || 14);

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
                <div className="op-showcase__rank-badge">
                  <span className="op-showcase__rank-lvl">{lvl}</span>
                  <span className="op-showcase__rank-lbl">LVL</span>
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
                <div className="meter meter--solid">
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
                    <div className="featured-ac__sil" aria-hidden="true" />
                    <div className="featured-ac__meta">
                      <h3 className="featured-ac__name">{acLabel}</h3>
                      <p className="featured-ac__line">
                        Skin Default · Emblem Wing · Trail off
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
                    <button type="button" className="medal-card is-on" data-sfx="select">
                      <span className="medal-card__icon">◆</span>
                      <span className="medal-card__name">CP-ACE</span>
                      <span className="medal-card__meta">Checkpoint</span>
                    </button>
                    <button type="button" className="medal-card" data-sfx="select">
                      <span className="medal-card__icon">◇</span>
                      <span className="medal-card__name">NO-SCRATCH</span>
                      <span className="medal-card__meta">Clean run</span>
                    </button>
                    <button type="button" className="medal-card" data-sfx="select">
                      <span className="medal-card__icon">▣</span>
                      <span className="medal-card__name">RAPTOR SPEC</span>
                      <span className="medal-card__meta">Mastery</span>
                    </button>
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
          <p className="pre-col__label glitch-el">Coleção · 6 / 24</p>
          <div className="medal-wall medal-wall--wide glitch-el">
            {(
              [
                ["◆", "CP-ACE", false],
                ["◇", "NO-SCRATCH", false],
                ["▣", "RAPTOR SPEC", false],
                ["▲", "STREAK-5", false],
                ["●", "DAWN RUN", false],
                ["✕", "FIRST BLOOD", false],
                ["+", "NIGHT OPS", true],
                ["+", "TVT ACE", true],
              ] as const
            ).map(([icon, name, locked]) => (
              <button
                key={name}
                type="button"
                className={`medal-card${locked ? " medal-card--empty" : name === "CP-ACE" ? " is-on" : ""}`}
                disabled={locked}
                data-sfx={locked ? "deny" : "select"}
              >
                <span className="medal-card__icon">{icon}</span>
                <span className="medal-card__name">{name}</span>
                <span className="medal-card__meta">
                  {locked ? "Locked" : "Owned"}
                </span>
              </button>
            ))}
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
