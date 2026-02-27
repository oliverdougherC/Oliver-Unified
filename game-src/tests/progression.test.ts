import { describe, expect, it } from 'vitest';
import { projectLevel, xpThresholdForLevel } from '@/core/progression';

describe('xp progression', () => {
  it('has increasing xp thresholds', () => {
    expect(xpThresholdForLevel(1)).toBeLessThan(xpThresholdForLevel(2));
    expect(xpThresholdForLevel(2)).toBeLessThan(xpThresholdForLevel(3));
  });

  it('projects correct level from total xp', () => {
    const first = xpThresholdForLevel(1);
    const second = xpThresholdForLevel(2);

    const projection = projectLevel(first + second + 7);

    expect(projection.level).toBe(3);
    expect(projection.xpIntoLevel).toBe(7);
    expect(projection.xpForNext).toBe(xpThresholdForLevel(3));
  });
});
