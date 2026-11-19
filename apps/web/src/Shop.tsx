import { useEffect, useState } from "react";
import type { LocalProgress } from "@afd/game-core";
import {
  fetchPremiumShop,
  fetchShop,
  purchaseItemApi,
  stubBuyPass,
  stubCheckoutDc,
  type DcPack,
  type PassOffer,
  type ShopItem,
} from "./api/economyClient";
import type { HubId } from "./HubNav";
import { MenuTop } from "./MenuTop";

type Tab = "credits" | "premium" | "pass";

interface Props {
  progress: LocalProgress;
  dashiCoins: number;
  onProgress: (p: LocalProgress) => void;
  onDashiCoins: (n: number) => void;
  apiToken: string | null;
  onNavigate: (hub: HubId) => void;
  onOpenSeason?: () => void;
}

/** Catálogo visual idêntico a reestilo/telas/loja.html */
const CREDIT_CARDS = [
  { name: "PAINT · LAKE DUSK", meta: "800 CR · Common" },
  { name: "EMBLEM · WING", meta: "1.200 CR · Rare" },
  { name: "FRAME · SIGNAL", meta: "2.000 CR · Epic" },
  { name: "PACK · PILOT STARTER", meta: "3.500 CR · Bundle" },
] as const;

const PREMIUM_CARDS = [
  { name: "DC · 500", meta: "R$ 14,90", on: true },
  { name: "DC · 1200", meta: "R$ 29,90", on: false },
  { name: "STARTER PACK", meta: "DC + skins · R$ 19,90", on: false },
  { name: "SEASONAL PACK", meta: "cosméticos · R$ 34,90", on: false },
] as const;

export function Shop({
  progress,
  dashiCoins,
  onProgress,
  onDashiCoins,
  apiToken,
  onNavigate,
  onOpenSeason,
}: Props) {
  const [tab, setTab] = useState<Tab>("credits");
  const [items, setItems] = useState<ShopItem[]>([]);
  const [packs, setPacks] = useState<DcPack[]>([]);
  const [passes, setPasses] = useState<PassOffer[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchShop(apiToken)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        /* visual catalog remains */
      });
    fetchPremiumShop(apiToken)
      .then((data) => {
        if (cancelled) return;
        setPacks(data.packs);
        setPasses(data.passes);
      })
      .catch(() => {
        /* optional */
      });
    return () => {
      cancelled = true;
    };
  }, [apiToken]);

  const buyCreditsByIndex = async (index: number) => {
    const item = items[index];
    if (!item || !apiToken) {
      setMsg(apiToken ? "Item indisponível na API" : "Conecte a API para comprar");
      return;
    }
    try {
      const res = await purchaseItemApi(apiToken, item.id);
      onProgress({ ...progress, credits: res.wallet.credits });
      setMsg(`Comprado: ${item.name}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha na compra");
    }
  };

  const buyPackByIndex = async (index: number) => {
    const pack = packs[index];
    if (!pack || !apiToken) {
      setMsg("API offline");
      return;
    }
    try {
      const res = await stubCheckoutDc(apiToken, pack.id);
      onDashiCoins(res.wallet.dashiCoins);
      onProgress({ ...progress, credits: res.wallet.credits });
      setMsg(`Stub checkout · +${res.creditedDc} DC`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha no checkout");
    }
  };

  const buyPass = async () => {
    const offer = passes[0];
    if (!apiToken || !offer) {
      onOpenSeason?.();
      return;
    }
    try {
      await stubBuyPass(apiToken, offer.id);
      setMsg(`${offer.name} desbloqueado`);
      onOpenSeason?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha no passe");
    }
  };

  return (
    <>
      <MenuTop
        mode="hub"
        kicker="STORE"
        title="Loja"
        credits={progress.credits}
        dashiCoins={dashiCoins}
        onBack={() => onNavigate("menu")}
        onNavigate={onNavigate}
      />

      <main className="hub-shell">
        <nav className="hub-side" aria-label="Loja">
          <button
            type="button"
            className={`hub-side__item${tab === "credits" ? " is-on" : ""}`}
            data-sfx="select"
              onClick={() => setTab("credits")}
          >
            Credits
          </button>
          <button
            type="button"
            className={`hub-side__item${tab === "premium" ? " is-on" : ""}`}
            data-sfx="select"
              onClick={() => setTab("premium")}
          >
            Premium
          </button>
          <button
            type="button"
            className={`hub-side__item${tab === "pass" ? " is-on" : ""}`}
            data-sfx="select"
              onClick={() => setTab("pass")}
          >
            Passe
          </button>
        </nav>

        <section className="hub-main">
          <div
            className={`hub-panel${tab === "credits" ? " is-on" : ""}`}
            hidden={tab !== "credits"}
          >
            <div className="shop__grid">
              {CREDIT_CARDS.map((card, i) => (
                <button
                  key={card.name}
                  type="button"
                  className="hangar__card"
                  data-sfx="select"
              onClick={() => void buyCreditsByIndex(i)}
                >
                  <span className="hangar__name">{card.name}</span>
                  <span className="hangar__meta">{card.meta}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            className={`hub-panel${tab === "premium" ? " is-on" : ""}`}
            hidden={tab !== "premium"}
          >
            <p
              className="hub__empty tag tag--ok"
              style={{ display: "inline-flex", marginBottom: 12 }}
            >
              Sem pay-to-win
            </p>
            <div className="shop__grid">
              {PREMIUM_CARDS.map((card, i) => (
                <button
                  key={card.name}
                  type="button"
                  className={`hangar__card${card.on ? " hangar__card--on" : ""}`}
                  data-sfx="select"
              onClick={() => void buyPackByIndex(i)}
                >
                  <span className="hangar__name">{card.name}</span>
                  <span className="hangar__meta">{card.meta}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            className={`hub-panel${tab === "pass" ? " is-on" : ""}`}
            hidden={tab !== "pass"}
          >
            <p className="hub__sub">
              Atalho — progressão completa na Carreira · Temporada
            </p>
            <div className="row wrap">
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
              onClick={() => onOpenSeason?.()}
              >
                Abrir Temporada
              </button>
            </div>
          </div>

          {msg ? <p className="hub__empty">{msg}</p> : null}
        </section>
      </main>
    </>
  );
}
