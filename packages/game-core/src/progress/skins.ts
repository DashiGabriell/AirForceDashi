/** Livreas do slot Paint. O albedo do modelo é multiplicado por `tint`. */

export const JET_SKINS = [
  { id: "factory", label: "FACTORY", tint: 0xffffff, metalness: 0.4, roughness: 0.48 },
  { id: "ghost", label: "GHOST", tint: 0xd5e2ea, metalness: 0.72, roughness: 0.22 },
  { id: "night", label: "NIGHT", tint: 0x243040, metalness: 0.55, roughness: 0.5 },
  { id: "desert", label: "DESERT", tint: 0xc6a15a, metalness: 0.32, roughness: 0.58 },
  { id: "crimson", label: "CRIMSON", tint: 0xc42832, metalness: 0.38, roughness: 0.4 },
] as const;

export type JetSkinId = (typeof JET_SKINS)[number]["id"];

export type JetSkin = (typeof JET_SKINS)[number];

export function jetSkinById(id: string | undefined | null): JetSkin {
  return JET_SKINS.find((skin) => skin.id === id) ?? JET_SKINS[0];
}

export function jetSkinSwatch(id: string): string {
  const tint = jetSkinById(id).tint;
  return `#${tint.toString(16).padStart(6, "0")}`;
}
