import { describe, expect, it } from 'vitest';
import { getWaveStageAt } from '@/data/waves';

describe('wave progression', () => {
  it('returns increasingly intense stages over time', () => {
    const early = getWaveStageAt(30);
    const mid = getWaveStageAt(260);
    const late = getWaveStageAt(700);

    expect(early.spawnInterval).toBeGreaterThan(mid.spawnInterval);
    expect(mid.spawnInterval).toBeGreaterThan(late.spawnInterval);
    expect(early.maxConcurrent).toBeLessThan(mid.maxConcurrent);
    expect(mid.maxConcurrent).toBeLessThan(late.maxConcurrent);
  });
});
