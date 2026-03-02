import type { DirectorBand } from '../types';

export const DIRECTOR_BANDS: DirectorBand[] = [
  {
    id: 'awakening',
    startTime: 0,
    endTime: 60,
    targetEnemiesMin: 4,
    targetEnemiesMax: 9,
    targetThreatMin: 6,
    targetThreatMax: 11,
    projectileHazardMin: 0,
    projectileHazardMax: 2,
    baseSpawnInterval: 0.56
  },
  {
    id: 'wild_hunt',
    startTime: 60,
    endTime: 180,
    targetEnemiesMin: 8,
    targetEnemiesMax: 20,
    targetThreatMin: 12,
    targetThreatMax: 26,
    projectileHazardMin: 2,
    projectileHazardMax: 8,
    baseSpawnInterval: 0.38
  },
  {
    id: 'chaos_bloom',
    startTime: 180,
    endTime: 360,
    targetEnemiesMin: 30,
    targetEnemiesMax: 58,
    targetThreatMin: 40,
    targetThreatMax: 82,
    projectileHazardMin: 4,
    projectileHazardMax: 12,
    baseSpawnInterval: 0.17
  },
  {
    id: 'cataclysm',
    startTime: 360,
    endTime: 540,
    targetEnemiesMin: 45,
    targetEnemiesMax: 70,
    targetThreatMin: 62,
    targetThreatMax: 104,
    projectileHazardMin: 8,
    projectileHazardMax: 16,
    baseSpawnInterval: 0.15
  },
  {
    id: 'overrun',
    startTime: 540,
    endTime: 1200,
    targetEnemiesMin: 55,
    targetEnemiesMax: 82,
    targetThreatMin: 78,
    targetThreatMax: 128,
    projectileHazardMin: 10,
    projectileHazardMax: 20,
    baseSpawnInterval: 0.12
  }
];

export function getDirectorBand(timeSeconds: number): DirectorBand {
  const t = Math.max(0, timeSeconds);
  for (const band of DIRECTOR_BANDS) {
    if (t >= band.startTime && t < band.endTime) {
      return band;
    }
  }
  return DIRECTOR_BANDS[DIRECTOR_BANDS.length - 1];
}
