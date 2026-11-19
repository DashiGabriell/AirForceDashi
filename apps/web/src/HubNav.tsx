export type HubId =
  | "menu"
  | "hangar"
  | "career"
  | "shop"
  | "profile"
  | "settings"
  | "lobby";

interface Props {
  active?: HubId;
  onNavigate: (hub: HubId) => void;
}

const ITEMS: Array<{ id: HubId; label: string }> = [
  { id: "hangar", label: "Hangar" },
  { id: "career", label: "Carreira" },
  { id: "shop", label: "Loja" },
  { id: "lobby", label: "Lobby" },
  { id: "profile", label: "Perfil" },
  { id: "settings", label: "Config" },
];

export function HubNav({ active, onNavigate }: Props) {
  return (
    <nav className="hubnav" aria-label="Hubs">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            active === item.id ? "hubnav__btn hubnav__btn--on" : "hubnav__btn"
          }
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
