import { useEffect, useState } from "react";
import type { LocalProgress } from "@afd/game-core";
import {
  fetchPremiumShop,
  fetchShop,
  purchaseItemApi,
  purchasePremiumApi,
  stubBuyPass,
  stubCheckoutDc,
  type DcPack,
  type PassOffer,
  type PremiumItem,
  type ShopItem,
} from "./api/economyClient";
import { HubNav } from "./HubNav";

type Tab = "credits" | "premium" | "pass";

interface Props {
  progress: LocalProgress;
  dashiCoins: number;
  onProgress: (p: LocalProgress) => void;
  onDashiCoins: (n: number) => void;
  apiToken: string | null;
  onNavigate: (
    hub: "menu" | "hangar" | "career" | "shop" | "profile" | "settings" | "lobby",
  ) => void;
  onOpenSeason?: () => void;
}

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
  const [premium, setPremium] = useState<PremiumItem[]>([]);
  const [passes, setPasses] = useState<PassOffer[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchShop(apiToken)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setMsg("API offline — loja indisponível");
      });
    fetchPremiumShop(apiToken)
      .then((data) => {
        if (cancelled) return;
        setPacks(data.packs);
        setPremium(data.items);
        setPasses(data.passes);
      })
      .catch(() => {
        /* optional */
      });
    return () => {
      cancelled = true;
    };
  }, [apiToken]);

  const buyCredits = async (item: ShopItem) => {
    if (!apiToken) {
      setMsg("Conecte a API (npm run api) para comprar");
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

  const buyPack = async (pack: DcPack) => {
    if (!apiToken) {
      setMsg("API offline");
      return;
    }
    try {
      const res = await stubCheckoutDc(apiToken, pack.id);
      onDashiCoins(res.wallet.dashiCoins);
      onProgress({ ...progress, credits: res.wallet.credits });
      setMsg(`Stub checkout · +${res.creditedDc} DC (sem pagamento real)`);
      const data = await fetchPremiumShop(apiToken);
      setPacks(data.packs);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha no checkout");
    }
  };

  const buyPremium = async (item: PremiumItem) => {
    if (!apiToken) return;
    try {
      const res = await purchasePremiumApi(apiToken, item.id);
      onDashiCoins(res.wallet.dashiCoins);
      setMsg(`Comprado: ${item.name}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha");
    }
  };

  const buyPass = async (offer: PassOffer) => {
    if (!apiToken) return;
    try {
      await stubBuyPass(apiToken, offer.id);
      setMsg(`${offer.name} desbloqueado (stub R$ ${offer.priceBrl.toFixed(2)})`);
      onOpenSeason?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "falha no passe");
    }
  };

  return (
    <div className="hub">
      <button type="button" className="pre__back" onClick={() => onNavigate("menu")}>
        ← Menu
      </button>
      <HubNav active="shop" onNavigate={onNavigate} />
      <h1 className="hub__title">LOJA</h1>
      <div className="pre__accent" />
      <p className="hub__sub">
        Credits {progress.credits.toLocaleString("pt-BR")} · DC{" "}
        {dashiCoins.toLocaleString("pt-BR")} · só identidade
      </p>

      <div className="hub__tabs" role="tablist" aria-label="Loja">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "credits"}
          className={tab === "credits" ? "hub__tab hub__tab--on" : "hub__tab"}
          onClick={() => setTab("credits")}
        >
          Credits
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "premium"}
          className={tab === "premium" ? "hub__tab hub__tab--on" : "hub__tab"}
          onClick={() => setTab("premium")}
        >
          Premium
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pass"}
          className={tab === "pass" ? "hub__tab hub__tab--on" : "hub__tab"}
          onClick={() => setTab("pass")}
        >
          Passe
        </button>
      </div>

      {tab === "credits" ? (
        <div className="shop__grid">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="hangar__card"
              onClick={() => void buyCredits(item)}
            >
              <span className="hangar__name">{item.name}</span>
              <span className="hangar__meta">
                {item.rarity} · {item.costCredits.toLocaleString("pt-BR")} Credits
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {tab === "premium" ? (
        <div className="hub__panel">
          <h2 className="hub__section">Pacotes DC</h2>
          <div className="shop__grid">
            {packs.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className="hangar__card"
                disabled={pack.available === false}
                onClick={() => void buyPack(pack)}
              >
                <span className="hangar__name">{pack.name}</span>
                <span className="hangar__meta">
                  R$ {pack.priceBrl.toFixed(2).replace(".", ",")} · stub checkout
                  {pack.oneTime ? " · one-time" : ""}
                </span>
              </button>
            ))}
          </div>
          <h2 className="hub__section">Cosméticos Epic / Legendary</h2>
          <div className="shop__grid">
            {premium.map((item) => (
              <button
                key={item.id}
                type="button"
                className="hangar__card"
                onClick={() => void buyPremium(item)}
              >
                <span className="hangar__name">{item.name}</span>
                <span className="hangar__meta">
                  {item.rarity} · {item.costDashiCoins} DC
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "pass" ? (
        <div className="hub__panel">
          <p className="hub__sub">Atalho — progressão completa na aba Temporada</p>
          <div className="shop__grid">
            {passes.map((offer) => (
              <button
                key={offer.id}
                type="button"
                className="hangar__card"
                onClick={() => void buyPass(offer)}
              >
                <span className="hangar__name">{offer.name}</span>
                <span className="hangar__meta">
                  R$ {offer.priceBrl.toFixed(2).replace(".", ",")}
                  {offer.bonusLevels
                    ? ` · +${offer.bonusLevels} níveis`
                    : ""}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => onOpenSeason?.()}
          >
            Abrir Temporada
          </button>
        </div>
      ) : null}

      {msg ? <p className="hub__empty">{msg}</p> : null}
      <p className="hub__empty">Sem pay-to-win — nenhum item altera combate.</p>
    </div>
  );
}
