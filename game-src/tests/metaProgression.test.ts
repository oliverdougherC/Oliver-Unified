import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isMetaProgressionEnabled,
  loadMetaProgression,
  setMetaProgressionEnabled,
  updateMetaProgression
} from '@/core/metaProgression';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('meta progression', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('supports explicit feature-flag enable/disable', () => {
    expect(isMetaProgressionEnabled()).toBe(false);

    setMetaProgressionEnabled(true);
    expect(isMetaProgressionEnabled()).toBe(true);

    setMetaProgressionEnabled(false);
    expect(isMetaProgressionEnabled()).toBe(false);
  });

  it('tracks aggregate run stats with versioned storage', () => {
    expect(loadMetaProgression()).toEqual({
      version: 1,
      totalRuns: 0,
      totalKills: 0,
      bestRunSeconds: 0,
      lastSeed: 0
    });

    updateMetaProgression({
      seed: 1234,
      timeSeconds: 180,
      level: 4,
      kills: 37,
      enemiesAlive: 22,
      upgradesChosen: ['sap_shot', 'rapid_vines']
    });

    const afterSecondRun = updateMetaProgression({
      seed: 9876,
      timeSeconds: 240,
      level: 6,
      kills: 58,
      enemiesAlive: 28,
      upgradesChosen: ['forest_stride', 'bark_skin']
    });

    expect(afterSecondRun).toEqual({
      version: 1,
      totalRuns: 2,
      totalKills: 95,
      bestRunSeconds: 240,
      lastSeed: 9876
    });
  });
});
