import type { Graphics } from 'pixi.js';
import { PainterlyBiomeComposer } from '../src/render/painterlyBiomeComposer';
import { createVisualTheme } from '../src/render/visualTheme';

function createGraphicsStub(): Graphics {
  const noop = () => {};
  return {
    clear: noop,
    rect: noop,
    fill: noop,
    ellipse: noop,
    roundRect: noop,
    poly: noop,
    stroke: noop,
    moveTo: noop,
    bezierCurveTo: noop,
    lineTo: noop,
    circle: noop
  } as unknown as Graphics;
}

describe('painterly biome composer cache', () => {
  it('prewarms nearby chunks to avoid startup backdrop pop-in', () => {
    const composer = new PainterlyBiomeComposer();
    composer.prewarm(0, 0);

    const stats = composer.getStats();
    expect(stats.chunkCount).toBeGreaterThanOrEqual(35);
  });

  it('bounds chunk growth during long camera travel', () => {
    const composer = new PainterlyBiomeComposer();
    const graphics = createGraphicsStub();
    const theme = createVisualTheme('normal');

    for (let i = 0; i < 80; i += 1) {
      composer.draw(graphics, {
        width: 1280,
        height: 720,
        cameraX: i * 680,
        cameraY: 0,
        timeMs: i * 16.67,
        motionScale: 1,
        reducedMotion: false,
        theme,
        budgetTier: 'high',
        suppressionTier: 'none',
        backgroundDensity: 0.72,
        atmosphereStrength: 0.42,
        eventTint: 0
      });
    }

    const stats = composer.getStats();
    expect(stats.chunkCount).toBeLessThanOrEqual(140);
    expect(stats.drawnCards).toBeGreaterThan(0);
    expect(stats.drawCommandsEstimate).toBeGreaterThan(0);
  });

  it('respects per-frame card budget caps', () => {
    const composer = new PainterlyBiomeComposer();
    const graphics = createGraphicsStub();
    const theme = createVisualTheme('normal');

    composer.draw(graphics, {
      width: 1280,
      height: 720,
      cameraX: 0,
      cameraY: 0,
      timeMs: 16.67,
      motionScale: 1,
      reducedMotion: false,
      theme,
      budgetTier: 'low',
      suppressionTier: 'none',
      backgroundDensity: 0.72,
      atmosphereStrength: 0.42,
      eventTint: 0,
      maxCards: 42,
      chunkBuildBudget: 8
    });
    const stats = composer.getStats();
    expect(stats.drawnCards).toBeLessThanOrEqual(42);
  });
});
