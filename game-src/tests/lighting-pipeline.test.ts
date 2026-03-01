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

    const near = pipeline.sampleIlluminance(10, 10);
    const far = pipeline.sampleIlluminance(440, 0);
    expect(near).toBeGreaterThan(far);
  });
});
