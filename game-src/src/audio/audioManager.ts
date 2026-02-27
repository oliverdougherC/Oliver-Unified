type AudioContextCtor = typeof AudioContext;

function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = window.AudioContext || (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  return ctor ?? null;
}

export class AudioManager {
  private enabled: boolean;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.7;
  private lastShotAt = 0;
  private lastHitAt = 0;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = 0.2 * this.volume;
    }
  }

  async unlock(): Promise<void> {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioCtor = resolveAudioContextCtor();
      if (!AudioCtor) return;

      this.context = new AudioCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.2 * this.volume;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  playShot(): void {
    const ctx = this.context;
    if (!this.enabled || !ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    if (now - this.lastShotAt < 0.05) return;
    this.lastShotAt = now;

    this.playTone({
      type: 'triangle',
      frequency: 520,
      gain: 0.04,
      duration: 0.055,
      slideTo: 300
    });
  }

  playPlayerHit(): void {
    const ctx = this.context;
    if (!this.enabled || !ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    if (now - this.lastHitAt < 0.12) return;
    this.lastHitAt = now;

    this.playTone({
      type: 'sawtooth',
      frequency: 140,
      gain: 0.08,
      duration: 0.14,
      slideTo: 90
    });
  }

  playLevelUp(): void {
    if (!this.enabled) return;
    this.playTone({
      type: 'triangle',
      frequency: 392,
      gain: 0.07,
      duration: 0.11,
      at: 0
    });
    this.playTone({
      type: 'triangle',
      frequency: 494,
      gain: 0.06,
      duration: 0.12,
      at: 0.06
    });
    this.playTone({
      type: 'triangle',
      frequency: 587,
      gain: 0.055,
      duration: 0.15,
      at: 0.12
    });
  }

  playUpgradePick(): void {
    this.playTone({
      type: 'sine',
      frequency: 660,
      gain: 0.06,
      duration: 0.08,
      slideTo: 780
    });
  }

  playEventStart(): void {
    this.playTone({
      type: 'sine',
      frequency: 460,
      gain: 0.05,
      duration: 0.13,
      at: 0
    });
    this.playTone({
      type: 'sine',
      frequency: 690,
      gain: 0.045,
      duration: 0.18,
      at: 0.08
    });
  }

  playGameOver(): void {
    if (!this.enabled) return;
    this.playTone({
      type: 'triangle',
      frequency: 220,
      gain: 0.08,
      duration: 0.18,
      slideTo: 140,
      at: 0
    });
    this.playTone({
      type: 'triangle',
      frequency: 146,
      gain: 0.07,
      duration: 0.28,
      slideTo: 96,
      at: 0.14
    });
  }

  private playTone(options: {
    type: OscillatorType;
    frequency: number;
    gain: number;
    duration: number;
    slideTo?: number;
    at?: number;
  }): void {
    const ctx = this.context;
    const master = this.masterGain;
    if (!this.enabled || !ctx || !master) return;

    const startAt = ctx.currentTime + (options.at ?? 0);
    const endAt = startAt + options.duration;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = options.type;
    osc.frequency.setValueAtTime(options.frequency, startAt);
    if (options.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.slideTo), endAt);
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(options.gain, startAt + Math.min(0.02, options.duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    osc.connect(gain);
    gain.connect(master);

    osc.start(startAt);
    osc.stop(endAt + 0.02);
  }
}
