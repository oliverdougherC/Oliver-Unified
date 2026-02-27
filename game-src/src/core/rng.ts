const DEFAULT_SEED = 1337;

export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return DEFAULT_SEED;
  const normalized = Math.floor(seed) >>> 0;
  return normalized === 0 ? DEFAULT_SEED : normalized;
}

export function parseSeedFromQuery(value: string | null): number {
  if (!value) return DEFAULT_SEED;
  const parsed = Number.parseInt(value, 10);
  return normalizeSeed(parsed);
}

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = normalizeSeed(seed);
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(this.float(low, high + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    return items[this.int(0, items.length - 1)];
  }

  weightedKey(weights: Record<string, number>): string {
    const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
    if (entries.length === 0) {
      throw new Error('No positive weights provided');
    }

    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.float(0, total);

    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }

    return entries[entries.length - 1][0];
  }
}
