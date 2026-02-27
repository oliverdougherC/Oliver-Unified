export interface LoopStats {
  frameTimeMs: number;
  smoothedFrameTimeMs: number;
  fps: number;
}

interface FixedStepLoopOptions {
  fixedDelta: number;
  maxDelta: number;
  onUpdate: (dt: number) => void;
  onRender: (alpha: number, stats: LoopStats) => void;
}

export class FixedStepLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private smoothedFrameTimeMs = 16.67;
  private running = false;

  constructor(private readonly options: FixedStepLoopOptions) {}

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

    while (this.accumulator >= this.options.fixedDelta) {
      this.options.onUpdate(this.options.fixedDelta);
      this.accumulator -= this.options.fixedDelta;
    }

    const frameTimeMs = deltaSeconds * 1000;
    this.smoothedFrameTimeMs = this.smoothedFrameTimeMs * 0.92 + frameTimeMs * 0.08;

    this.options.onRender(this.accumulator / this.options.fixedDelta, {
      frameTimeMs,
      smoothedFrameTimeMs: this.smoothedFrameTimeMs,
      fps: frameTimeMs > 0 ? 1000 / frameTimeMs : 60
    });

    this.rafId = requestAnimationFrame(this.tick);
  };
}
