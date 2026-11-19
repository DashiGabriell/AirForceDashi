/** Cosméticos do Hangar · Equipar. Só visual — sem buff. */

export const JET_EMBLEMS = [
  { id: "wing", label: "Wing" },
  { id: "signal", label: "Signal" },
] as const;

export const JET_EFFECTS = [
  { id: "trail_off", label: "Trail off" },
  { id: "ember", label: "Ember" },
] as const;

export type JetEmblemId = (typeof JET_EMBLEMS)[number]["id"];
export type JetEffectId = (typeof JET_EFFECTS)[number]["id"];

export function jetEmblemById(id: string | undefined | null): (typeof JET_EMBLEMS)[number] {
  return JET_EMBLEMS.find((e) => e.id === id) ?? JET_EMBLEMS[0];
}

export function jetEffectById(id: string | undefined | null): (typeof JET_EFFECTS)[number] {
  return JET_EFFECTS.find((e) => e.id === id) ?? JET_EFFECTS[0];
}
