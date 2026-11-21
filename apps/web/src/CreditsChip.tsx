interface Props {
  credits: number;
  dashiCoins?: number;
  phase?: string;
}

export function CreditsChip({
  credits,
  dashiCoins = 0,
  phase = "M8 WEB",
}: Props) {
  return (
    <div className="menu__chip menu__chip--currency" aria-label="Saldo">
      <img
        className="menu__chip-icon"
        src="/ui/currency/icon_cr.png"
        alt=""
        width={18}
        height={18}
        draggable={false}
      />
      <span>{credits.toLocaleString("pt-BR")}</span>
      <img
        className="menu__chip-icon"
        src="/ui/currency/icon_dc.png"
        alt=""
        width={18}
        height={18}
        draggable={false}
      />
      <span>{dashiCoins.toLocaleString("pt-BR")}</span>
      <span>· {phase}</span>
    </div>
  );
}
