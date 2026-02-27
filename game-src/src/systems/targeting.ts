import type { Vec2 } from '../types';

export interface TargetCandidate {
  id: number;
  position: Vec2;
}

export function findNearestEnemy(
  origin: Vec2,
  enemies: readonly TargetCandidate[],
  maxRange: number
): TargetCandidate | null {
  const maxRangeSq = maxRange * maxRange;
  let best: TargetCandidate | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    const dx = enemy.position.x - origin.x;
    const dy = enemy.position.y - origin.y;
    const distSq = dx * dx + dy * dy;

    if (distSq > maxRangeSq) continue;
    if (distSq >= bestDistSq) continue;

    bestDistSq = distSq;
    best = enemy;
  }

  return best;
}
