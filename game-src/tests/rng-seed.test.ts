import { describe, expect, it } from 'vitest';
import { planSpawnSequence } from '@/systems/spawnPlanner';

describe('seed determinism', () => {
  it('produces identical spawn order for same seed', () => {
    const runA = planSpawnSequence(4242, 120);
    const runB = planSpawnSequence(4242, 120);

    expect(runA).toEqual(runB);
  });

  it('produces a different order for different seeds', () => {
    const runA = planSpawnSequence(4242, 120);
    const runB = planSpawnSequence(9991, 120);

    expect(runA).not.toEqual(runB);
  });
});
