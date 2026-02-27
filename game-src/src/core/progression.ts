export function xpThresholdForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.round(20 + (safeLevel - 1) * 16 + (safeLevel - 1) * (safeLevel - 1) * 3);
}

export function projectLevel(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
} {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));

  while (remaining >= xpThresholdForLevel(level)) {
    remaining -= xpThresholdForLevel(level);
    level += 1;
  }

  return {
    level,
    xpIntoLevel: remaining,
    xpForNext: xpThresholdForLevel(level)
  };
}
