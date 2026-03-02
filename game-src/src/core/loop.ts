export interface LoopStats {
  frameTimeMs: number;
  smoothedFrameTimeMs: number;
  fps: number;
  updateMs: number;
  updateSteps: number;
}

interface FixedStepLoopOptions {
  fixedDelta: number;
  maxDelta: number;
  maxSubSteps?: number;
  onUpdate: (dt: number) => void;
  onRender: (alpha: number, stats: LoopStats) => void;
}

export class FixedStepLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private smoothedFrameTimeMs = 16.67;
  private running = false;
  private maxSubSteps: number;

  constructor(private readonly options: FixedStepLoopOptions) {
    this.maxSubSteps = Math.max(1, Math.floor(options.maxSubSteps ?? 3));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resetAccumulator(): void {
    this.accumulator = 0;
    this.lastTime = performance.now();
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    const deltaSecondsRaw = (now - this.lastTime) / 1000;
    this.lastTime = now;

    const deltaSeconds = Math.min(deltaSecondsRaw, this.options.maxDelta);
    this.accumulator += deltaSeconds;

    let updateMs = 0;
    let updateSteps = 0;
    while (this.accumulator >= this.options.fixedDelta && updateSteps < this.maxSubSteps) {
      const updateStart = performance.now();
      this.options.onUpdate(this.options.fixedDelta);
      updateMs += performance.now() - updateStart;
      this.accumulator -= this.options.fixedDelta;
      updateSteps += 1;
    }
    if (this.accumulator >= this.options.fixedDelta) {
      // Prevent spiral-of-death catch-up under sustained stalls; prefer responsive rendering.
      this.accumulator = 0;
    }

    const frameTimeMs = deltaSeconds * 1000;
    this.smoothedFrameTimeMs = this.smoothedFrameTimeMs * 0.92 + frameTimeMs * 0.08;

    this.options.onRender(this.accumulator / this.options.fixedDelta, {
      frameTimeMs,
      smoothedFrameTimeMs: this.smoothedFrameTimeMs,
      fps: frameTimeMs > 0 ? 1000 / frameTimeMs : 60,
      updateMs,
      updateSteps
    });

    this.rafId = requestAnimationFrame(this.tick);
  };
}
