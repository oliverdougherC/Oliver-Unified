import { describe, expect, it } from 'vitest';
import { SpatialHash } from '@/core/spatialHash';

describe('spatial hash broadphase', () => {
  it('returns nearby candidates and excludes far entities', () => {
    const hash = new SpatialHash(100);

    hash.insert(1, { x: 0, y: 0 }, 8);
    hash.insert(2, { x: 45, y: 22 }, 8);
    hash.insert(3, { x: 400, y: 400 }, 8);

    const nearby = hash.queryCircle({ x: 10, y: 10 }, 80);

    expect(nearby).toContain(1);
    expect(nearby).toContain(2);
    expect(nearby).not.toContain(3);
  });

  it('respects max candidate cap', () => {
    const hash = new SpatialHash(20);

    for (let i = 0; i < 10; i += 1) {
      hash.insert(i, { x: i * 4, y: 0 }, 5);
    }

    const nearby = hash.queryCircle({ x: 8, y: 0 }, 30, 3);
    expect(nearby.length).toBeLessThanOrEqual(3);
  });
});
