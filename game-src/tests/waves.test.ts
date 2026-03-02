import { describe, expect, it } from 'vitest';
import { getWaveStageAt } from '@/data/waves';
import { ENEMY_ARCHETYPES } from '@/data/enemies';

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

  it('only references live enemy archetype ids', () => {
    const sampledStages = [getWaveStageAt(30), getWaveStageAt(260), getWaveStageAt(700)];
    for (const stage of sampledStages) {
      for (const enemyId of Object.keys(stage.weights)) {
        expect(ENEMY_ARCHETYPES[enemyId], `Unknown enemy in wave stage ${stage.id}: ${enemyId}`).toBeDefined();
      }
    }
  });
});
