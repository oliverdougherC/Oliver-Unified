import { getWaveStageAt } from '../data/waves';
import { SeededRng } from '../core/rng';

export function planSpawnSequence(seed: number, durationSeconds: number): string[] {
  const rng = new SeededRng(seed);
  const out: string[] = [];

  let t = 0;
  let spawnAccumulator = 0;
  const dt = 0.2;

  while (t < durationSeconds) {
    const stage = getWaveStageAt(t);
    spawnAccumulator += dt;

    while (spawnAccumulator >= stage.spawnInterval) {
      spawnAccumulator -= stage.spawnInterval;
      out.push(rng.weightedKey(stage.weights));
    }

    t += dt;
  }

  return out;
}
