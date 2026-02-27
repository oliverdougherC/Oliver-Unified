import type { RunSnapshot } from '../types';

const META_KEY = 'forestArcana.meta.v1';
const META_ENABLED_KEY = 'forestArcana.meta.enabled.v1';

export interface MetaProgressionV1 {
  version: 1;
  totalRuns: number;
  totalKills: number;
  bestRunSeconds: number;
  lastSeed: number;
}

function defaultMetaProgression(): MetaProgressionV1 {
  return {
    version: 1,
    totalRuns: 0,
    totalKills: 0,
    bestRunSeconds: 0,
    lastSeed: 0
  };
}

function getStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function isMetaProgressionEnabled(): boolean {
  return getStorage()?.getItem(META_ENABLED_KEY) === '1';
}

export function setMetaProgressionEnabled(enabled: boolean): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(META_ENABLED_KEY, enabled ? '1' : '0');
}

export function loadMetaProgression(): MetaProgressionV1 {
  const storage = getStorage();
  if (!storage) return defaultMetaProgression();

  try {
    const parsed = JSON.parse(storage.getItem(META_KEY) || '{}') as Partial<MetaProgressionV1>;
    if (parsed.version !== 1) {
      return defaultMetaProgression();
    }

    return {
      version: 1,
      totalRuns: Number(parsed.totalRuns) || 0,
      totalKills: Number(parsed.totalKills) || 0,
      bestRunSeconds: Number(parsed.bestRunSeconds) || 0,
      lastSeed: Number(parsed.lastSeed) || 0
    };
  } catch {
    return defaultMetaProgression();
  }
}

export function updateMetaProgression(snapshot: RunSnapshot): MetaProgressionV1 {
  const storage = getStorage();
  if (!storage) return defaultMetaProgression();

  const current = loadMetaProgression();

  const next: MetaProgressionV1 = {
    version: 1,
    totalRuns: current.totalRuns + 1,
    totalKills: current.totalKills + snapshot.kills,
    bestRunSeconds: Math.max(current.bestRunSeconds, snapshot.timeSeconds),
    lastSeed: snapshot.seed
  };

  storage.setItem(META_KEY, JSON.stringify(next));
  return next;
}
