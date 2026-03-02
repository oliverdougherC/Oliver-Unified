import { LightingPipeline } from '../src/render/lightingPipeline';

describe('lighting pipeline', () => {
  it('accumulates and clears dynamic lights/casters', () => {
    const pipeline = new LightingPipeline();
    pipeline.addLight({
      x: 0,
      y: 0,
      radius: 120,
      color: 0xffffff,
      intensity: 0.8,
      falloff: 0.7,
      flicker: 0,
      castsShadow: true,
      layerMask: 1
    });
    pipeline.addShadowCaster({
      id: 1,
      shape: 'circle',
      x: 12,
      y: 8,
      radius: 14,
      height: 0.4,
      softness: 0.7
    });

    expect(pipeline.getCounts().lights).toBe(1);
    expect(pipeline.getCounts().shadowCasters).toBe(1);

    pipeline.clearDynamicData();
    expect(pipeline.getCounts().lights).toBe(0);
    expect(pipeline.getCounts().shadowCasters).toBe(0);
  });

  it('returns stronger illuminance near lights than far away', () => {
    const pipeline = new LightingPipeline();
    pipeline.addLight({
      x: 0,
      y: 0,
      radius: 180,
      color: 0x99ffff,
      intensity: 1,
      falloff: 0.75,
      flicker: 0,
      castsShadow: false,
      layerMask: 1
    });

    pipeline.prepareSamplingGrid({
      width: 1280,
      height: 720,
      cameraX: 0,
      cameraY: 0,
      centerX: 640,
      centerY: 360,
      budgetTier: 'high',
      safariSafeMode: false
    });
    const near = pipeline.sampleIlluminance(10, 10);
    const far = pipeline.sampleIlluminance(440, 0);
    expect(near).toBeGreaterThan(far);
    expect(pipeline.getSampleCount()).toBe(2);
  });

  it('selects highest-priority lights when over budget', () => {
    const pipeline = new LightingPipeline() as unknown as {
      selectTopPriorityLights: (lights: Array<{ id: number; intensity: number; priority?: number }>, max: number) => Array<{ id: number }>;
    };
    const selected = pipeline.selectTopPriorityLights(
      [
        { id: 1, intensity: 0.2, priority: 0.2 },
        { id: 2, intensity: 0.5, priority: 4 },
        { id: 3, intensity: 0.9, priority: 2 },
        { id: 4, intensity: 0.8, priority: 3 }
      ],
      2
    );
    expect(selected.map((light) => light.id)).toEqual([2, 4]);
  });
});
