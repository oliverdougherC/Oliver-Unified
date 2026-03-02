import type { IObjectPool } from '../types';

export class ObjectPool<T> implements IObjectPool<T> {
  private readonly freeList: T[] = [];
  private totalAllocated = 0;

  constructor(
    private readonly createItem: () => T,
    private readonly resetItem: (item: T) => void
  ) {}

  acquire(): T {
    const item = this.freeList.pop();
    if (item !== undefined) return item;
    this.totalAllocated += 1;
    return this.createItem();
  }

  release(item: T): void {
    this.resetItem(item);
    this.freeList.push(item);
  }

  reset(): void {
    this.freeList.length = 0;
    this.totalAllocated = 0;
  }

  getStats(): { available: number; total: number } {
    return {
      available: this.freeList.length,
      total: this.totalAllocated
    };
  }
}

export class NumericIdPool implements IObjectPool<number> {
  private readonly freeList: number[] = [];
  private readonly start: number;
  private next: number;
  private totalAllocated = 0;

  constructor(start: number) {
    this.start = start;
    this.next = start;
  }

  acquire(): number {
    const reused = this.freeList.pop();
    if (reused !== undefined) return reused;
    const id = this.next;
    this.next += 1;
    this.totalAllocated += 1;
    return id;
  }

  release(item: number): void {
    this.freeList.push(item);
  }

  reset(): void {
    this.freeList.length = 0;
    this.next = this.start;
    this.totalAllocated = 0;
  }

  getStats(): { available: number; total: number } {
    return {
      available: this.freeList.length,
      total: this.totalAllocated
    };
  }
}
