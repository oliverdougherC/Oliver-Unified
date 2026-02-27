import type { Vec2 } from '../types';

function keyFor(x: number, y: number): string {
  return `${x}:${y}`;
}

export class SpatialHash {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly cellSize: number) {}

  clear(): void {
    this.buckets.clear();
  }

  insert(entityId: number, position: Vec2, radius: number): void {
    const minX = Math.floor((position.x - radius) / this.cellSize);
    const maxX = Math.floor((position.x + radius) / this.cellSize);
    const minY = Math.floor((position.y - radius) / this.cellSize);
    const maxY = Math.floor((position.y + radius) / this.cellSize);

    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellY = minY; cellY <= maxY; cellY += 1) {
        const key = keyFor(cellX, cellY);
        const bucket = this.buckets.get(key);
        if (bucket) {
          bucket.push(entityId);
        } else {
          this.buckets.set(key, [entityId]);
        }
      }
    }
  }

  queryCircle(position: Vec2, radius: number, maxCandidates = Infinity): number[] {
    const minX = Math.floor((position.x - radius) / this.cellSize);
    const maxX = Math.floor((position.x + radius) / this.cellSize);
    const minY = Math.floor((position.y - radius) / this.cellSize);
    const maxY = Math.floor((position.y + radius) / this.cellSize);

    const out = new Set<number>();

    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellY = minY; cellY <= maxY; cellY += 1) {
        const bucket = this.buckets.get(keyFor(cellX, cellY));
        if (!bucket) continue;

        for (const entityId of bucket) {
          out.add(entityId);
          if (out.size >= maxCandidates) {
            return Array.from(out);
          }
        }
      }
    }

    return Array.from(out);
  }
}
