import type { WaveStage } from '../types';

export const WAVE_STAGES: WaveStage[] = [
  {
    id: 'dusk_whisper',
    startTime: 0,
    endTime: 150,
    spawnInterval: 1.08,
    maxConcurrent: 26,
    threatCap: 26,
    weights: {
      brambleling: 0.72,
      moss_hound: 0.28
    }
  },
  {
    id: 'moon_tangle',
    startTime: 150,
    endTime: 330,
    spawnInterval: 0.82,
    maxConcurrent: 40,
    threatCap: 45,
    weights: {
      brambleling: 0.28,
      moss_hound: 0.3,
      thorn_sentinel: 0.13,
      elder_bark: 0.08,
      briar_lancer: 0.13,
      spore_channeler: 0.08
    }
  },
  {
    id: 'thornfall',
    startTime: 330,
    endTime: 540,
    spawnInterval: 0.62,
    maxConcurrent: 58,
    threatCap: 69,
    weights: {
      brambleling: 0.13,
      moss_hound: 0.19,
      spore_wisp: 0.2,
      thorn_sentinel: 0.15,
      briar_lancer: 0.15,
      spore_channeler: 0.18
    }
  },
  {
    id: 'ancient_howl',
    startTime: 540,
    endTime: 1200,
    spawnInterval: 0.5,
    maxConcurrent: 74,
    threatCap: 98,
    weights: {
      brambleling: 0.08,
      moss_hound: 0.13,
      spore_wisp: 0.23,
      thorn_sentinel: 0.14,
      elder_bark: 0.14,
      briar_lancer: 0.12,
      spore_channeler: 0.16
    }
  }
];

export function getWaveStageAt(timeSeconds: number): WaveStage {
  const t = Math.max(0, timeSeconds);
  for (const stage of WAVE_STAGES) {
    if (t >= stage.startTime && t < stage.endTime) {
      return stage;
    }
  }
  return WAVE_STAGES[WAVE_STAGES.length - 1];
}
