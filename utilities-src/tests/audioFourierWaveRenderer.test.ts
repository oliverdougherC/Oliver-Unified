import {
  resolveAudioWaveBucketX,
  resolveAudioWaveCanvasScale
} from '@utilities/audioFourierWaveRenderer';

describe('audio Fourier wave renderer', () => {
  it('keeps small waveform canvases crisp while capping extreme DPR work', () => {
    expect(resolveAudioWaveCanvasScale(800, 300, 2)).toBe(2);
    expect(resolveAudioWaveCanvasScale(2160, 1800, 2)).toBeCloseTo(1.014, 3);
  });

  it('keeps extreme canvases above the minimum readability scale', () => {
    expect(resolveAudioWaveCanvasScale(4096, 4096, 2)).toBe(1);
    expect(resolveAudioWaveCanvasScale(800, 300, 0)).toBe(1);
  });

  it('allows the software canvas fallback to trade resolution for frame pacing', () => {
    expect(resolveAudioWaveCanvasScale(2160, 1800, 2, 750_000, 0.3)).toBeCloseTo(0.439, 3);
    expect(resolveAudioWaveCanvasScale(4096, 4096, 2, 750_000, 0.3)).toBe(0.3);
  });

  it('maps later waveform buckets against absolute viewport sample coordinates', () => {
    expect(resolveAudioWaveBucketX(100, 10_000, 2_000, 100, 1_000)).toBe(0);
    expect(resolveAudioWaveBucketX(110, 10_000, 2_000, 100, 1_000)).toBe(500);
    expect(resolveAudioWaveBucketX(120, 10_000, 2_000, 100, 1_000)).toBe(1000);
  });

  it('sanitizes invalid coordinate inputs without producing non-finite canvas positions', () => {
    expect(resolveAudioWaveBucketX(Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 800)).toBe(0);
    expect(resolveAudioWaveBucketX(4, 0, Number.NaN, Number.NaN, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
