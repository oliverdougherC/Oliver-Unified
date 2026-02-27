import { describe, expect, it } from 'vitest';
import { findNearestEnemy } from '@/systems/targeting';

describe('auto-target selection', () => {
  it('picks nearest enemy within range', () => {
    const target = findNearestEnemy(
      { x: 0, y: 0 },
      [
        { id: 10, position: { x: 200, y: 0 } },
        { id: 11, position: { x: 120, y: 40 } },
        { id: 12, position: { x: 310, y: -20 } }
      ],
      260
    );

    expect(target?.id).toBe(11);
  });

  it('returns null when no enemy is in range', () => {
    const target = findNearestEnemy(
      { x: 0, y: 0 },
      [{ id: 1, position: { x: 600, y: 20 } }],
      250
    );

    expect(target).toBeNull();
  });
});
