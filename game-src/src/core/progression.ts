export function xpThresholdForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));

  if (safeLevel <= 5) {
    const early = safeLevel - 1;
    return Math.round(40 + early * 32 + early * early * 10);
  }

  if (safeLevel <= 10) {
    const mid = safeLevel - 5;
    return Math.round(328 + mid * 72 + mid * mid * 18);
  }

  const late = safeLevel - 10;
  return Math.round(1060 + late * 92 + late * late * 22);
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
