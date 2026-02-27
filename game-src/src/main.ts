import { FixedStepLoop, type LoopStats } from './core/loop';
import {
  isMetaProgressionEnabled,
  loadMetaProgression,
  setMetaProgressionEnabled,
  updateMetaProgression
} from './core/metaProgression';
import { AudioManager } from './audio/audioManager';
import { parseSeedFromQuery } from './core/rng';
import { GameWorld } from './core/world';
import { PixiRenderAdapter } from './render/pixiRenderAdapter';
import { getRunEventDescription, getRunEventLabel } from './data/events';
import type { ISystem, QueryOptions, QualityTier, RendererPreference } from './types';
import { AutoAttackSystem } from './systems/autoAttackSystem';
import { CleanupSystem } from './systems/cleanupSystem';
import { CollisionSystem } from './systems/collisionSystem';
import { EnemyAISystem } from './systems/enemyAISystem';
import { LevelSystem } from './systems/levelSystem';
import { MovementSystem } from './systems/movementSystem';
import { PlayerInputSystem } from './systems/playerInputSystem';
import { ProjectileSystem } from './systems/projectileSystem';
import { RuntimeSystem } from './systems/runtimeSystem';
import { SpawnSystem } from './systems/spawnSystem';
import { XpSystem } from './systems/xpSystem';

const SETTINGS_KEY = 'forestArcana.settings.v1';
const DEBUG_KEY = 'forestArcana.debug.v1';

interface SettingsPayload {
  rendererPreference: RendererPreference;
  quality: QualityTier;
  audioEnabled: boolean;
  audioVolume: number;
  motionScale: number;
}

function parseRendererPreference(value: string | null): RendererPreference {
  if (value === 'webgpu' || value === 'webgl' || value === 'auto') return value;
  return 'auto';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadSettings(): SettingsPayload {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<SettingsPayload>;
    const parsedVolume = Number(parsed.audioVolume);
    const parsedMotion = Number(parsed.motionScale);
    return {
      rendererPreference: parseRendererPreference(parsed.rendererPreference || 'auto'),
      quality: parsed.quality === 'low' || parsed.quality === 'medium' || parsed.quality === 'high'
        ? parsed.quality
        : 'high',
      audioEnabled: parsed.audioEnabled !== false,
      audioVolume: Number.isFinite(parsedVolume) ? clamp(parsedVolume, 0, 1) : 0.7,
      motionScale: Number.isFinite(parsedMotion) ? clamp(parsedMotion, 0, 1) : 1
    };
  } catch {
    return {
      rendererPreference: 'auto',
      quality: 'high',
      audioEnabled: true,
      audioVolume: 0.7,
      motionScale: 1
    };
  }
}

function saveSettings(next: SettingsPayload): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function parseMetaFlag(value: string | null): boolean | null {
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

function parseAudioFlag(value: string | null): boolean | null {
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

function parsePercentFlag(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed > 1 || parsed < 0) {
    return clamp(parsed / 100, 0, 1);
  }
  return clamp(parsed, 0, 1);
}

function parseOptions(): QueryOptions {
  const url = new URL(window.location.href);
  const settings = loadSettings();
  const rendererPreference = parseRendererPreference(
    url.searchParams.get('renderer') || settings.rendererPreference
  );
  const debugFromQuery = url.searchParams.get('debug');
  const seed = parseSeedFromQuery(url.searchParams.get('seed'));
  const metaFlagFromQuery = parseMetaFlag(url.searchParams.get('meta'));
  const audioFlagFromQuery = parseAudioFlag(url.searchParams.get('audio'));
  const volumeFromQuery = parsePercentFlag(url.searchParams.get('volume'));
  const motionFromQuery = parsePercentFlag(url.searchParams.get('motion'));

  const debugMode =
    debugFromQuery === '1' ||
    (debugFromQuery !== '0' && localStorage.getItem(DEBUG_KEY) === '1');

  const metaEnabled = metaFlagFromQuery ?? isMetaProgressionEnabled();
  const audioEnabled = audioFlagFromQuery ?? settings.audioEnabled;
  const audioVolume = volumeFromQuery ?? settings.audioVolume;
  const motionScale = motionFromQuery ?? settings.motionScale;

  localStorage.setItem(DEBUG_KEY, debugMode ? '1' : '0');
  setMetaProgressionEnabled(metaEnabled);

  return {
    rendererPreference,
    debugMode,
    seed,
    metaEnabled,
    audioEnabled,
    audioVolume,
    motionScale
  };
}

function formatRunTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function chooseQuality(smoothedMs: number, current: QualityTier): QualityTier {
  if (current === 'high') {
    if (smoothedMs > 24) return 'low';
    if (smoothedMs > 19) return 'medium';
    return current;
  }

  if (current === 'medium') {
    if (smoothedMs > 24) return 'low';
    if (smoothedMs < 16) return 'high';
    return current;
  }

  if (smoothedMs < 18) return 'medium';
  return current;
}

function keyToMovementFlag(key: string): 'up' | 'down' | 'left' | 'right' | null {
  if (key === 'w' || key === 'arrowup') return 'up';
  if (key === 's' || key === 'arrowdown') return 'down';
  if (key === 'a' || key === 'arrowleft') return 'left';
  if (key === 'd' || key === 'arrowright') return 'right';
  return null;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element as T;
}

async function main(): Promise<void> {
  const options = parseOptions();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const world = new GameWorld(options.seed, prefersReducedMotion);
  const renderer = new PixiRenderAdapter();
  const audio = new AudioManager(options.audioEnabled);

  const gameShell = requireElement<HTMLElement>('gameShell');
  const gameRoot = requireElement<HTMLElement>('gameRoot');
  const bootScreen = requireElement<HTMLElement>('bootScreen');
  const startGameBtn = requireElement<HTMLButtonElement>('startGameBtn');
  const unsupportedPanel = requireElement<HTMLElement>('unsupportedPanel');
  const hud = requireElement<HTMLElement>('hud');
  const pauseBanner = requireElement<HTMLElement>('pauseBanner');
  const levelUpModal = requireElement<HTMLElement>('levelUpModal');
  const upgradeGrid = requireElement<HTMLElement>('upgradeGrid');
  const gameOverModal = requireElement<HTMLElement>('gameOverModal');
  const settingsPanel = requireElement<HTMLElement>('settingsPanel');
  const settingsToggleBtn = requireElement<HTMLButtonElement>('settingsToggleBtn');
  const settingsCloseBtn = requireElement<HTMLButtonElement>('settingsCloseBtn');
  const settingsApplyRendererBtn = requireElement<HTMLButtonElement>('settingsApplyRendererBtn');
  const settingsAudioEnabled = requireElement<HTMLInputElement>('settingsAudioEnabled');
  const settingsAudioVolume = requireElement<HTMLInputElement>('settingsAudioVolume');
  const settingsAudioVolumeValue = requireElement<HTMLElement>('settingsAudioVolumeValue');
  const settingsMotionIntensity = requireElement<HTMLInputElement>('settingsMotionIntensity');
  const settingsMotionIntensityValue = requireElement<HTMLElement>('settingsMotionIntensityValue');
  const settingsRendererPreference = requireElement<HTMLSelectElement>('settingsRendererPreference');
  const restartRunBtn = requireElement<HTMLButtonElement>('restartRunBtn');
  const runSummary = requireElement<HTMLElement>('runSummary');
  const metaSummary = requireElement<HTMLElement>('metaSummary');
  const debugPanel = requireElement<HTMLElement>('debugPanel');

  const hudHp = requireElement<HTMLElement>('hudHp');
  const hudLevel = requireElement<HTMLElement>('hudLevel');
  const hudEnemies = requireElement<HTMLElement>('hudEnemies');
  const hudTime = requireElement<HTMLElement>('hudTime');
  const hudEventChip = requireElement<HTMLElement>('hudEventChip');
  const hudEvent = requireElement<HTMLElement>('hudEvent');
  const hudAudio = requireElement<HTMLElement>('hudAudio');
  const hudRenderer = requireElement<HTMLElement>('hudRenderer');
  const xpFill = requireElement<HTMLElement>('xpFill');

  let pausedByVisibility = false;
  let pausedBySettings = false;
  let settingsOpen = false;
  let lastUpgradeSignature = '';
  let runPersisted = false;
  let preferredRenderer = options.rendererPreference;
  let audioEnabled = options.audioEnabled;
  let audioVolume = options.audioVolume;
  let motionScale = prefersReducedMotion ? Math.min(options.motionScale, 0.35) : options.motionScale;
  let previousShotsFired = 0;
  let previousPlayerHitCount = 0;
  let previousLevelUpOfferedCount = 0;
  let previousUpgradeCount = 0;
  let previousEventId: string | null = null;
  let previousUiState = world.uiState;

  function syncTopChromeOffsets(): void {
    const shellRect = gameShell.getBoundingClientRect();
    const hudBottom = hud.classList.contains('hidden')
      ? 0
      : Math.max(0, hud.getBoundingClientRect().bottom - shellRect.top);
    const topAnchor = Math.max(68, Math.round(hudBottom + 8));
    gameShell.style.setProperty('--hud-stack-bottom', `${topAnchor}px`);
  }

  try {
    const rendererKind = await renderer.init({
      mount: gameRoot,
      requestedRenderer: options.rendererPreference,
      reducedMotion: prefersReducedMotion
    });

    world.setRendererKind(rendererKind);

    const settings = loadSettings();
    saveSettings({
      rendererPreference: preferredRenderer,
      quality: settings.quality,
      audioEnabled,
      audioVolume,
      motionScale
    });

    audio.setEnabled(audioEnabled);
    audio.setVolume(audioVolume);
    renderer.setMotionScale(motionScale);
    hudRenderer.textContent = rendererKind;
  } catch (error) {
    console.error(error);
    unsupportedPanel.classList.remove('hidden');
    bootScreen.classList.add('hidden');
    hud.classList.add('hidden');
    return;
  }

  world.setQuality(loadSettings().quality);
  renderer.setQuality(world.quality);

  if (options.debugMode) {
    debugPanel.classList.remove('hidden');
  }

  syncTopChromeOffsets();
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      syncTopChromeOffsets();
    });
    observer.observe(hud);
  }
  window.addEventListener('resize', syncTopChromeOffsets);

  const systems: ISystem<GameWorld>[] = [
    new RuntimeSystem(),
    new PlayerInputSystem(),
    new EnemyAISystem(),
    new AutoAttackSystem(),
    new SpawnSystem(),
    new XpSystem(),
    new MovementSystem(),
    new ProjectileSystem(),
    new CollisionSystem(),
    new LevelSystem(),
    new CleanupSystem()
  ];

  function renderUpgradeChoices(): void {
    const signature = world.pendingUpgradeChoices.map((option) => option.id).join('|');
    if (signature === lastUpgradeSignature) return;

    lastUpgradeSignature = signature;
    upgradeGrid.innerHTML = '';

    world.pendingUpgradeChoices.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'upgrade-btn';
      button.innerHTML = `<strong>${index + 1}. ${option.name}</strong><span>${option.description}</span>`;
      button.addEventListener('click', () => {
        world.applyUpgrade(option.id);
        levelUpModal.classList.add('hidden');
      });
      upgradeGrid.appendChild(button);
    });
  }

  function chooseUpgradeByIndex(index: number): void {
    if (world.uiState !== 'levelup') return;
    const option = world.pendingUpgradeChoices[index];
    if (!option) return;

    world.applyUpgrade(option.id);
    levelUpModal.classList.add('hidden');
  }

  function clearMovementInput(): void {
    world.input.up = false;
    world.input.down = false;
    world.input.left = false;
    world.input.right = false;
  }

  function persistSettings(quality: QualityTier): void {
    saveSettings({
      rendererPreference: preferredRenderer,
      quality,
      audioEnabled,
      audioVolume,
      motionScale
    });
  }

  function syncSettingsControls(): void {
    settingsAudioEnabled.checked = audioEnabled;
    settingsAudioVolume.value = String(Math.round(audioVolume * 100));
    settingsAudioVolumeValue.textContent = `${Math.round(audioVolume * 100)}%`;
    settingsAudioVolume.disabled = !audioEnabled;
    settingsMotionIntensity.value = String(Math.round(motionScale * 100));
    settingsMotionIntensityValue.textContent = `${Math.round(motionScale * 100)}%`;
    settingsRendererPreference.value = preferredRenderer;
  }

  function openSettings(): void {
    if (settingsOpen) return;
    settingsOpen = true;
    syncSettingsControls();
    settingsPanel.classList.remove('hidden');
    clearMovementInput();

    if (world.uiState === 'playing') {
      pausedBySettings = true;
      pauseRun('Paused - Settings Open');
    } else {
      pausedBySettings = false;
    }
  }

  function closeSettings(): void {
    if (!settingsOpen) return;
    settingsOpen = false;
    settingsPanel.classList.add('hidden');

    if (pausedBySettings && world.uiState === 'paused' && !document.hidden) {
      pausedBySettings = false;
      resumeRun();
    } else {
      pausedBySettings = false;
    }
  }

  function syncHud(): void {
    hudHp.textContent = `${Math.ceil(world.playerStats.hp)} / ${Math.ceil(world.playerStats.maxHp)}`;
    hudLevel.textContent = String(world.level);
    hudEnemies.textContent = String(world.getEnemyCount());
    hudTime.textContent = formatRunTime(world.runTime);
    hudEvent.textContent = getRunEventLabel(world.activeEventId);
    hudAudio.textContent = audioEnabled ? 'On' : 'Off';
    hudEventChip.classList.toggle('event-active', world.activeEventId !== null);
    hudEventChip.title = getRunEventDescription(world.activeEventId);
    const ratio = world.xpToNext > 0 ? Math.min(1, world.xp / world.xpToNext) : 0;
    xpFill.style.width = `${ratio * 100}%`;
  }

  function syncAudioCues(): void {
    if (world.shotsFired > previousShotsFired) {
      const delta = Math.min(3, world.shotsFired - previousShotsFired);
      for (let i = 0; i < delta; i += 1) {
        audio.playShot();
      }
    }

    if (world.playerHitCount > previousPlayerHitCount) {
      audio.playPlayerHit();
    }

    if (world.levelUpOfferedCount > previousLevelUpOfferedCount) {
      audio.playLevelUp();
    }

    if (world.chosenUpgrades.length > previousUpgradeCount) {
      audio.playUpgradePick();
    }

    if (world.activeEventId !== previousEventId && world.activeEventId) {
      audio.playEventStart();
    }

    if (previousUiState !== 'gameover' && world.uiState === 'gameover') {
      audio.playGameOver();
    }

    previousShotsFired = world.shotsFired;
    previousPlayerHitCount = world.playerHitCount;
    previousLevelUpOfferedCount = world.levelUpOfferedCount;
    previousUpgradeCount = world.chosenUpgrades.length;
    previousEventId = world.activeEventId;
    previousUiState = world.uiState;
  }

  function syncUiState(): void {
    pauseBanner.classList.toggle('hidden', world.uiState !== 'paused');
    settingsToggleBtn.classList.toggle('hidden', world.uiState === 'boot' || world.uiState === 'gameover');

    if (world.uiState === 'levelup') {
      renderUpgradeChoices();
      levelUpModal.classList.remove('hidden');
    } else {
      levelUpModal.classList.add('hidden');
      lastUpgradeSignature = '';
    }

    if (world.uiState === 'gameover') {
      gameOverModal.classList.remove('hidden');
      runSummary.textContent = world.toRunSummaryText();

      if (!runPersisted && options.metaEnabled) {
        updateMetaProgression(world.getSnapshot());
        runPersisted = true;
      }

      if (options.metaEnabled) {
        const meta = loadMetaProgression();
        metaSummary.classList.remove('hidden');
        metaSummary.textContent = [
          `Meta ${meta.totalRuns} runs`,
          `${meta.totalKills} kills`,
          `best ${formatRunTime(meta.bestRunSeconds)}`
        ].join(' | ');
      } else {
        metaSummary.classList.add('hidden');
      }
    } else {
      gameOverModal.classList.add('hidden');
      metaSummary.classList.add('hidden');
    }
  }

  function syncDebug(stats: LoopStats): void {
    if (debugPanel.classList.contains('hidden')) return;

    const enemyPoolStats = world.enemyPool.getStats();
    const projectilePoolStats = world.projectilePool.getStats();
    const enemyProjectilePoolStats = world.enemyProjectilePool.getStats();
    const hazardPoolStats = world.hazardPool.getStats();
    const xpPoolStats = world.xpPool.getStats();

    debugPanel.textContent = [
      `seed: ${world.seed}`,
      `ui: ${world.uiState}`,
      `renderer: ${world.rendererKind}`,
      `meta: ${options.metaEnabled ? 'enabled' : 'off'}`,
      `audio: ${audioEnabled ? 'on' : 'off'}`,
      `volume: ${Math.round(audioVolume * 100)}%`,
      `motion: ${Math.round(motionScale * 100)}%`,
      `fps: ${stats.fps.toFixed(1)}`,
      `frame: ${stats.smoothedFrameTimeMs.toFixed(2)}ms`,
      `quality: ${world.quality}`,
      `event: ${world.activeEventId ?? 'none'}`,
      `entities: ${world.entities.size}`,
      `threat: ${world.threatLevel.toFixed(1)}`,
      `enemy shots: ${world.enemyShotsFired}`,
      `hazards: ${world.hazards.size}`,
      `enemy pool: ${enemyPoolStats.available}/${enemyPoolStats.total}`,
      `proj pool: ${projectilePoolStats.available}/${projectilePoolStats.total}`,
      `enemy proj pool: ${enemyProjectilePoolStats.available}/${enemyProjectilePoolStats.total}`,
      `hazard pool: ${hazardPoolStats.available}/${hazardPoolStats.total}`,
      `xp pool: ${xpPoolStats.available}/${xpPoolStats.total}`
    ].join('\n');
  }

  function startRun(seed = world.seed): void {
    void audio.unlock();
    world.resetRun(seed);
    settingsOpen = false;
    pausedBySettings = false;
    settingsPanel.classList.add('hidden');
    runPersisted = false;
    previousShotsFired = world.shotsFired;
    previousPlayerHitCount = world.playerHitCount;
    previousLevelUpOfferedCount = world.levelUpOfferedCount;
    previousUpgradeCount = world.chosenUpgrades.length;
    previousEventId = world.activeEventId;
    previousUiState = world.uiState;
    bootScreen.classList.add('hidden');
    gameOverModal.classList.add('hidden');
    levelUpModal.classList.add('hidden');
    pauseBanner.classList.add('hidden');
    hud.classList.remove('hidden');
    syncTopChromeOffsets();
    loop.resetAccumulator();
  }

  function pauseRun(message = 'Paused - Press Esc to Resume'): void {
    if (world.uiState !== 'playing') return;
    world.uiState = 'paused';
    pauseBanner.textContent = message;
    pauseBanner.classList.remove('hidden');
  }

  function resumeRun(): void {
    if (world.uiState !== 'paused') return;
    world.uiState = 'playing';
    pauseBanner.textContent = 'Paused - Press Esc to Resume';
    pauseBanner.classList.add('hidden');
    loop.resetAccumulator();
  }

  function stepSimulation(dt: number): void {
    if (world.uiState !== 'playing') return;
    for (const system of systems) {
      system.update(dt, world);
      if (world.uiState !== 'playing') break;
    }
  }

  function renderFrame(stats: LoopStats): void {
    const nextQuality = chooseQuality(stats.smoothedFrameTimeMs, world.quality);
    if (nextQuality !== world.quality) {
      world.setQuality(nextQuality);
      renderer.setQuality(nextQuality);
      persistSettings(nextQuality);
    }

    renderer.render(world, 0, stats.smoothedFrameTimeMs);
    syncAudioCues();
    syncHud();
    syncUiState();
    syncDebug(stats);
  }

  const loop = new FixedStepLoop({
    fixedDelta: world.config.fixedDelta,
    maxDelta: world.config.maxDelta,
    onUpdate: (dt) => stepSimulation(dt),
    onRender: (_alpha, stats) => renderFrame(stats)
  });

  function buildTextState(): string {
    const playerPos = world.getPlayerPosition();
    const playerVel = world.velocities.get(world.playerId) || { x: 0, y: 0 };

    const sortByDistanceToPlayer = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const da = (a.x - playerPos.x) ** 2 + (a.y - playerPos.y) ** 2;
      const db = (b.x - playerPos.x) ** 2 + (b.y - playerPos.y) ** 2;
      return da - db;
    };

    const enemies = Array.from(world.enemies)
      .map((enemyId) => {
        const pos = world.positions.get(enemyId);
        const comp = world.enemyComponents.get(enemyId);
        const health = world.health.get(enemyId);
        if (!pos || !comp || !health) return null;
        return {
          id: enemyId,
          x: Number(pos.x.toFixed(1)),
          y: Number(pos.y.toFixed(1)),
          archetype: comp.archetypeId,
          behavior: comp.behavior,
          hp: Number(health.hp.toFixed(1)),
          spitCooldown: Number(comp.spitCooldown.toFixed(2)),
          dashWindup: Number(comp.dashWindup.toFixed(2)),
          dashDuration: Number(comp.dashDuration.toFixed(2))
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort(sortByDistanceToPlayer)
      .slice(0, 24);

    const enemyProjectiles = Array.from(world.enemyProjectiles)
      .map((projectileId) => {
        const pos = world.positions.get(projectileId);
        const data = world.enemyProjectileComponents.get(projectileId);
        if (!pos || !data) return null;
        return {
          id: projectileId,
          x: Number(pos.x.toFixed(1)),
          y: Number(pos.y.toFixed(1)),
          ttl: Number(Math.max(0, data.lifetime - data.age).toFixed(2))
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort(sortByDistanceToPlayer)
      .slice(0, 24);

    const hazards = Array.from(world.hazards)
      .map((hazardId) => {
        const pos = world.positions.get(hazardId);
        const data = world.hazardComponents.get(hazardId);
        const radius = world.radii.get(hazardId);
        if (!pos || !data || radius === undefined) return null;
        return {
          id: hazardId,
          x: Number(pos.x.toFixed(1)),
          y: Number(pos.y.toFixed(1)),
          r: Number(radius.toFixed(1)),
          ttl: Number(Math.max(0, data.lifetime - data.age).toFixed(2))
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort(sortByDistanceToPlayer)
      .slice(0, 24);

    return JSON.stringify({
      coordinateSystem: 'World space with origin at player spawn (0,0), +x right, +y down.',
      uiState: world.uiState,
      timerSeconds: Number(world.runTime.toFixed(2)),
      player: {
        x: Number(playerPos.x.toFixed(1)),
        y: Number(playerPos.y.toFixed(1)),
        vx: Number(playerVel.x.toFixed(1)),
        vy: Number(playerVel.y.toFixed(1)),
        hp: Number(world.playerStats.hp.toFixed(1)),
        maxHp: Number(world.playerStats.maxHp.toFixed(1)),
        level: world.level,
        xp: Number(world.xp.toFixed(1)),
        xpToNext: Number(world.xpToNext.toFixed(1))
      },
      counts: {
        enemies: world.enemies.size,
        enemyProjectiles: world.enemyProjectiles.size,
        hazards: world.hazards.size,
        xpOrbs: world.xpOrbs.size
      },
      event: world.activeEventId,
      renderer: world.rendererKind,
      quality: world.quality,
      enemies,
      enemyProjectiles,
      hazards
    });
  }

  function installTestingHooks(): void {
    const testWindow = window as Window & {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => void;
    };

    testWindow.render_game_to_text = () => buildTextState();
    testWindow.advanceTime = (ms: number) => {
      const boundedMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
      const stepMs = world.config.fixedDelta * 1000;
      const steps = Math.max(1, Math.round(boundedMs / stepMs));
      for (let i = 0; i < steps; i += 1) {
        stepSimulation(world.config.fixedDelta);
      }

      const frameMs = steps > 0 ? Math.max(1, boundedMs / steps) : stepMs;
      renderFrame({
        frameTimeMs: frameMs,
        smoothedFrameTimeMs: frameMs,
        fps: 1000 / frameMs
      });
    };
  }

  installTestingHooks();
  loop.start();

  startGameBtn.addEventListener('click', () => {
    startRun(world.seed);
  });

  restartRunBtn.addEventListener('click', () => {
    startRun(world.seed);
  });

  settingsToggleBtn.addEventListener('click', () => {
    if (settingsOpen) {
      closeSettings();
    } else {
      openSettings();
    }
  });

  settingsCloseBtn.addEventListener('click', () => {
    closeSettings();
  });

  settingsPanel.addEventListener('click', (event) => {
    if (event.target === settingsPanel) {
      closeSettings();
    }
  });

  settingsAudioEnabled.addEventListener('change', () => {
    audioEnabled = settingsAudioEnabled.checked;
    audio.setEnabled(audioEnabled);
    if (audioEnabled) {
      void audio.unlock();
    }
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsAudioVolume.addEventListener('input', () => {
    audioVolume = clamp(Number(settingsAudioVolume.value) / 100, 0, 1);
    audio.setVolume(audioVolume);
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsMotionIntensity.addEventListener('input', () => {
    motionScale = clamp(Number(settingsMotionIntensity.value) / 100, 0, 1);
    renderer.setMotionScale(motionScale);
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsRendererPreference.addEventListener('change', () => {
    preferredRenderer = parseRendererPreference(settingsRendererPreference.value);
    persistSettings(world.quality);
  });

  settingsApplyRendererBtn.addEventListener('click', () => {
    persistSettings(world.quality);
    const url = new URL(window.location.href);
    url.searchParams.set('renderer', preferredRenderer);
    window.location.assign(url.toString());
  });

  syncSettingsControls();

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const movementFlag = keyToMovementFlag(key);

    if (settingsOpen) {
      if (key === 'escape' || key === 'o') {
        closeSettings();
        event.preventDefault();
      } else if (movementFlag || key === ' ') {
        event.preventDefault();
      }
      return;
    }

    if (key === 'o') {
      openSettings();
      event.preventDefault();
      return;
    }

    if (movementFlag) {
      world.input[movementFlag] = true;
      event.preventDefault();
      return;
    }

    if (key === 'escape') {
      if (world.uiState === 'playing') {
        pauseRun();
      } else if (world.uiState === 'paused') {
        resumeRun();
      }
      event.preventDefault();
      return;
    }

    if (key === 'm') {
      audioEnabled = !audioEnabled;
      audio.setEnabled(audioEnabled);
      if (audioEnabled) {
        void audio.unlock();
      }
      syncSettingsControls();
      persistSettings(world.quality);
      event.preventDefault();
      return;
    }

    if (world.uiState === 'levelup') {
      if (key === '1') chooseUpgradeByIndex(0);
      if (key === '2') chooseUpgradeByIndex(1);
      if (key === '3') chooseUpgradeByIndex(2);
      if (key === ' ') chooseUpgradeByIndex(0);
      event.preventDefault();
      return;
    }

    if (world.uiState === 'boot' && (key === 'enter' || key === ' ')) {
      startRun(world.seed);
      event.preventDefault();
      return;
    }

    if (world.uiState === 'gameover' && (key === 'enter' || key === ' ')) {
      startRun(world.seed);
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    const movementFlag = keyToMovementFlag(event.key.toLowerCase());
    if (!movementFlag) return;
    world.input[movementFlag] = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (world.uiState === 'playing') {
        pausedByVisibility = true;
        pauseRun('Paused - Tab hidden');
      }
      return;
    }

    if (!document.hidden && pausedByVisibility && world.uiState === 'paused') {
      pausedByVisibility = false;
      resumeRun();
    }
  });

  const canvas = renderer.getCanvas();
  if (canvas) {
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      pauseRun('Context lost - waiting for restore');
    });

    canvas.addEventListener('webglcontextrestored', () => {
      resumeRun();
    });
  }
}

main().catch((error) => {
  console.error('Fatal error while booting Forest Arcana:', error);
});
