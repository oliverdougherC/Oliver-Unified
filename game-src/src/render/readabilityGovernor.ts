import type {
  CombatReadabilityMode,
  ReadabilityGovernorState,
  SceneSuppressionTier
} from '../types';

export interface ReadabilityGovernorInput {
  enemyCount: number;
  hazardCount: number;
  hostileProjectileCount: number;
  p95FrameMs: number;
  mode: CombatReadabilityMode;
}

const RAMP_UP_MS = 380;
const RAMP_DOWN_MS = 1700;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function tierFromThreat(threatLevel: number): SceneSuppressionTier {
  if (threatLevel >= 0.78) return 'hard';
  if (threatLevel >= 0.56) return 'medium';
  if (threatLevel >= 0.34) return 'light';
  return 'none';
}

function tierWeight(tier: SceneSuppressionTier): number {
  if (tier === 'hard') return 3;
  if (tier === 'medium') return 2;
  if (tier === 'light') return 1;
  return 0;
}

function overridesForTier(tier: SceneSuppressionTier): ReadabilityGovernorState['appliedOverrides'] {
  if (tier === 'light') {
    return {
      atmosphereMultiplier: 0.8,
      backgroundDensityMultiplier: 0.88,
      fogMultiplier: 0.82,
      nonEssentialGlowMultiplier: 0.84,
      ambientParticleMultiplier: 0.8
    };
  }
  if (tier === 'medium') {
    return {
      atmosphereMultiplier: 0.56,
      backgroundDensityMultiplier: 0.6,
      fogMultiplier: 0.58,
      nonEssentialGlowMultiplier: 0.54,
      ambientParticleMultiplier: 0.55
    };
  }
  if (tier === 'hard') {
    return {
      atmosphereMultiplier: 0.3,
      backgroundDensityMultiplier: 0.4,
      fogMultiplier: 0.35,
      nonEssentialGlowMultiplier: 0.28,
      ambientParticleMultiplier: 0.24
    };
  }
  return {
    atmosphereMultiplier: 1,
    backgroundDensityMultiplier: 1,
    fogMultiplier: 1,
    nonEssentialGlowMultiplier: 1,
    ambientParticleMultiplier: 1
  };
}

export class ReadabilityGovernor {
  private state: ReadabilityGovernorState = {
    threatLevel: 0,
    activeSuppressionTier: 'none',
    appliedOverrides: overridesForTier('none')
  };

  private emaThreat = 0;
  private lastTierChangeMs = 0;

  reset(): void {
    this.state = {
      threatLevel: 0,
      activeSuppressionTier: 'none',
      appliedOverrides: overridesForTier('none')
    };
    this.emaThreat = 0;
    this.lastTierChangeMs = 0;
  }

  update(input: ReadabilityGovernorInput, nowMs = performance.now()): ReadabilityGovernorState {
    const enemyPressure = clamp(input.enemyCount / 66, 0, 1);
    const hazardPressure = clamp(input.hazardCount / 16, 0, 1);
    const projectilePressure = clamp(input.hostileProjectileCount / 20, 0, 1);
    const framePenalty = clamp((input.p95FrameMs - 16.5) / 16, 0, 1);

    const rawThreat =
      enemyPressure * 0.52 +
      hazardPressure * 0.2 +
      projectilePressure * 0.2 +
      framePenalty * 0.24;

    this.emaThreat = this.emaThreat * 0.72 + rawThreat * 0.28;
    const threatLevel = clamp(this.emaThreat, 0, 1);

    let targetTier = tierFromThreat(threatLevel);
    if (input.mode === 'off') {
      targetTier = 'none';
    } else if (input.mode === 'always_on' && tierWeight(targetTier) < tierWeight('light')) {
      targetTier = 'light';
    }

    const currentTier = this.state.activeSuppressionTier;
    const rising = tierWeight(targetTier) > tierWeight(currentTier);
    const elapsed = nowMs - this.lastTierChangeMs;
    const canSwitch = rising ? elapsed >= RAMP_UP_MS : elapsed >= RAMP_DOWN_MS;

    const nextTier = canSwitch ? targetTier : currentTier;
    if (nextTier !== currentTier) {
      this.lastTierChangeMs = nowMs;
    }

    this.state = {
      threatLevel,
      activeSuppressionTier: nextTier,
      appliedOverrides: overridesForTier(nextTier)
    };
    return this.getSnapshot();
  }

  getSnapshot(): ReadabilityGovernorState {
    return {
      threatLevel: this.state.threatLevel,
      activeSuppressionTier: this.state.activeSuppressionTier,
      appliedOverrides: { ...this.state.appliedOverrides }
    };
  }
}
