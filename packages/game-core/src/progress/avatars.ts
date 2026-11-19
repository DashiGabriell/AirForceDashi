/** Avatares de piloto — espelho do Godot `Game.AVATAR_*` (ids 0..5 → avatar_01..06). */

export const AVATAR_COUNT = 6;

const LABELS = [
  "RAPTOR-1",
  "FALCON-2",
  "VIPER-3",
  "HAWK-4",
  "EAGLE-5",
  "SHADOW-6",
] as const;

export function clampAvatarId(id: number): number {
  if (!Number.isFinite(id)) return 0;
  return Math.min(AVATAR_COUNT - 1, Math.max(0, Math.floor(id)));
}

export function avatarLabel(id: number): string {
  return LABELS[clampAvatarId(id)] ?? "PILOT";
}

/** Path público do cliente web (`apps/web/public/avatars`). */
export function avatarPublicPath(id: number): string {
  const n = clampAvatarId(id) + 1;
  return `/avatars/avatar_0${n}.png`;
}

export function avatarIds(): number[] {
  return Array.from({ length: AVATAR_COUNT }, (_, i) => i);
}
