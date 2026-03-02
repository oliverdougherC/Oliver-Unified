import { describe, expect, it, vi } from 'vitest';
import { PixiRenderAdapter } from '@/render/pixiRenderAdapter';
import { FixedStepLoop } from '@/core/loop';

describe('render budget evaluation cadence', () => {
  it('throttles percentile evaluation while still re-evaluating before tier cooldown expires', () => {
    const adapter = new PixiRenderAdapter() as unknown as {
      frameSamples: number[];
      budgetTier: string;
      lastTierChangeAt: number;
      lastBudgetEvalAt: number;
      quality: 'low' | 'medium' | 'high';
      desktopUltraProfile: boolean;
      visualSettings: { desktopUltraLock: boolean };
      updateBudget: (frameTimeMs: number) => void;
    };

    adapter.frameSamples = [31, 32, 33, 30, 34, 32, 35, 31, 36, 30, 32];
    adapter.budgetTier = 'ultra';
    adapter.lastTierChangeAt = 0;
    adapter.lastBudgetEvalAt = 0;
    adapter.quality = 'medium';

    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValue(1000);
    adapter.updateBudget(33);

    expect(adapter.budgetTier).toBe('minimal');
    expect(adapter.lastBudgetEvalAt).toBe(1000);
    expect(adapter.lastTierChangeAt).toBe(1000);

    nowSpy.mockReturnValue(1100);
    adapter.updateBudget(33);
    expect(adapter.lastBudgetEvalAt).toBe(1000);

    nowSpy.mockReturnValue(1300);
    adapter.updateBudget(33);
    expect(adapter.lastBudgetEvalAt).toBe(1300);
    expect(adapter.lastTierChangeAt).toBe(1000);

    nowSpy.mockRestore();
  });

  it('keeps budget above medium when desktop ultra lock is enabled', () => {
    const adapter = new PixiRenderAdapter() as unknown as {
      frameSamples: number[];
      budgetTier: string;
      lastTierChangeAt: number;
      lastBudgetEvalAt: number;
      quality: 'low' | 'medium' | 'high';
      desktopUltraProfile: boolean;
      visualSettings: { desktopUltraLock: boolean };
      updateBudget: (frameTimeMs: number) => void;
    };

    adapter.frameSamples = [31, 32, 33, 30, 34, 32, 35, 31, 36, 30, 32];
    adapter.budgetTier = 'ultra';
    adapter.lastTierChangeAt = 0;
    adapter.lastBudgetEvalAt = 0;
    adapter.quality = 'high';
    adapter.desktopUltraProfile = true;
    adapter.visualSettings = { desktopUltraLock: true };

    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValue(1000);
    adapter.updateBudget(33);

    expect(adapter.budgetTier).toBe('high');
    nowSpy.mockRestore();
  });
});

describe('fixed loop catch-up guard', () => {
  it('caps update steps per frame and drops excess accumulator', () => {
    const originalRaf = (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }).requestAnimationFrame;
    (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }).requestAnimationFrame = () => 1;
    let updates = 0;
    let capturedUpdateSteps = 0;
    let capturedUpdateMs = 0;
    const loop = new FixedStepLoop({
      fixedDelta: 1 / 60,
      maxDelta: 0.2,
      maxSubSteps: 3,
      onUpdate: () => {
        updates += 1;
      },
      onRender: (_alpha, stats) => {
        capturedUpdateSteps = stats.updateSteps;
        capturedUpdateMs = stats.updateMs;
      }
    });
    const internals = loop as unknown as {
      running: boolean;
      lastTime: number;
      accumulator: number;
      tick: (now: number) => void;
    };
    internals.running = true;
    internals.lastTime = 0;
    internals.accumulator = 0;
    internals.tick(200);
    expect(updates).toBe(3);
    expect(capturedUpdateSteps).toBe(3);
    expect(capturedUpdateMs).toBeGreaterThanOrEqual(0);
    expect(internals.accumulator).toBe(0);
    (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }).requestAnimationFrame = originalRaf;
  });
});
