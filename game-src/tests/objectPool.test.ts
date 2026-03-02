import { describe, expect, it } from 'vitest';
import { NumericIdPool } from '@/core/objectPool';

describe('numeric id pool', () => {
  it('resets next id back to pool start', () => {
    const pool = new NumericIdPool(1000);

    const first = pool.acquire();
    const second = pool.acquire();
    pool.release(first);
    pool.acquire();
    pool.reset();

    const afterReset = pool.acquire();
    expect(second).toBe(1001);
    expect(afterReset).toBe(1000);
    expect(pool.getStats().total).toBe(1);
  });
});
