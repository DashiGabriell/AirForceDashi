/** Simple XP curve + patent map (economia-v1 §10 simplified). */

const RANKS = [
  "Cadete",
  "Aviador",
  "3º Sargento",
  "2º Sargento",
  "1º Sargento",
  "Subtenente",
  "Tenente",
  "Capitão",
  "Major",
  "Coronel",
  "Ás",
];

export function levelFromXp(xp: number): number {
  let level = 1;
  let need = 100;
  let rem = Math.max(0, xp);
  while (rem >= need && level < 50) {
    rem -= need;
    level += 1;
    need = Math.floor(100 + level * 35);
  }
  return level;
}

export function rankFromLevel(level: number): string {
  const idx = Math.min(RANKS.length - 1, Math.max(0, Math.floor((level - 1) / 4)));
  return RANKS[idx]!;
}

export function xpProgress(xp: number): { level: number; rank: string; into: number; need: number } {
  let level = 1;
  let need = 100;
  let rem = Math.max(0, xp);
  while (rem >= need && level < 50) {
    rem -= need;
    level += 1;
    need = Math.floor(100 + level * 35);
  }
  return { level, rank: rankFromLevel(level), into: rem, need };
}
