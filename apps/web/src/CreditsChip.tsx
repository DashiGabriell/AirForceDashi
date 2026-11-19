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
    <div className="menu__chip" aria-label="Saldo">
      CR {credits.toLocaleString("pt-BR")} · DC {dashiCoins.toLocaleString("pt-BR")} ·{" "}
      {phase}
    </div>
  );
}
