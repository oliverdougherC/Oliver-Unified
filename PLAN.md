# Forest Arcana Game Platform Plan (WebGPU + WebGL, Stepwise)

## Summary
Build a dedicated, scalable game subsystem for your site with a hidden deep-scroll entry on the homepage and a desktop-first Vampire Survivors-style MVP.  
Implementation will use TypeScript + Vite, WebGPU primary rendering, WebGL fallback, clean module boundaries, fixed-timestep simulation, and data-driven content so we can expand safely without rewrites.

## Locked Product Decisions
- Entry: Dedicated game page.
- Discovery: Only the deep “Bored?” button (no nav/footer link).
- Homepage gag depth: Huge, about `~6` viewports of intentional empty scroll.
- Game genre loop: Top-down survivor-like roguelike.
- MVP gameplay: Movement + waves + auto-aim combat + XP/level-up choices.
- Controls: `WASD` movement + auto-target attacks.
- Platform target: Desktop first.
- Render strategy: WebGPU primary + WebGL fallback.
- Tech stack: TypeScript + Vite.
- Theme: Forest Arcana.
- Visual direction: Site-themed organic style.
- Progression: Run-only first (no persistent upgrades yet).
- Target run length for MVP: 10–12 minutes.
- Difficulty curve: Forgiving first 2–3 minutes, then ramps.

## Architecture (Decision-Complete)
### Runtime architecture
- Simulation and rendering are separate layers.
- Simulation runs fixed timestep at `60 Hz` with delta clamp to prevent spiral-of-death on tab resume.
- Rendering interpolates from simulation state and never owns gameplay state.
- Entity model uses lightweight ECS-style component stores (typed maps) with system modules.
- Collision uses circle colliders + spatial hash broadphase (cell size tuned to average enemy radius * 3).
- Frequent entities (enemies/projectiles/xp orbs) use object pools from first playable build.

### Renderer strategy
- Use PixiJS v8 renderer backend with preference `webgpu`, automatic fallback `webgl`.
- Expose active renderer in a small debug readout when `?debug=1`.
- If both fail, show non-crashing fallback UI with browser guidance.

### Content/data architecture
- All gameplay tuning is data-driven in typed config modules:
- Enemy archetypes, spawn tables, weapon archetypes, upgrade pools, difficulty curves.
- No hardcoded balancing constants inside system logic files.
- Versioned config schema to allow future migration.

### Input and UI architecture
- Keyboard-only first (`WASD`, `Esc`, `Space` for level-up confirm).
- UI states: boot, playing, paused, level-up modal, game-over.
- HUD: health, level, XP bar, timer, enemy count.
- Accessibility: motion-reduction mode reduces VFX intensity and removes screen shake.

## Planned File/Module Layout
- `/Users/ofhd/Developer/websites/oliver_unified_v2/index.html`  
  Add deep-scroll void section and “Bored?” gateway button linking to `pages/game/index.html`.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/css/landing.css`  
  Add holy-button visuals, deep-scroll spacing, reduced-motion variants.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/game-src/`  
  New TypeScript source root for game app.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/game-src/index.html`  
  Vite source HTML entry for dev/build.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/game-src/src/main.ts`  
  Boot orchestration and app lifecycle.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/game-src/src/core/*.ts`  
  Engine loop, ECS stores, scheduler, RNG, pooling, spatial hash.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/game-src/src/systems/*.ts`  
  Input, movement, AI, spawn, combat, collision, XP, level-up, cleanup.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/game-src/src/render/*.ts`  
  Pixi scene graph adapter, sprite/effect layers, camera follow.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/game-src/src/data/*.ts`  
  Enemy/weapon/upgrade/wave config.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/pages/game/`  
  Built static output from Vite (deployable route).
- `/Users/ofhd/Developer/websites/oliver_unified_v2/package.json`  
  Add game scripts and game dependencies.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/vite.config.game.mts`  
  Dedicated Vite config for game build.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/tsconfig.game.json`  
  TS config scoped to game subsystem.
- `/Users/ofhd/Developer/websites/oliver_unified_v2/scripts/smoke.js`  
  Add checks for bored gate and game route existence.

## Milestone Plan
### Milestone 0: Entry + Tooling + Boot Shell
- Add deep-scroll “void” homepage section and holy glowing “Bored?” button at the very bottom of that section.
- Create game toolchain (`TS + Vite`) and build output route `pages/game/index.html`.
- Add game boot screen with renderer detection and fallback messaging.
- Add minimal quality hooks: game route smoke checks and TS typecheck script.

Exit criteria:
- Homepage has comical deep scroll and button-only discovery.
- `pages/game/index.html` loads.
- Renderer mode is visible in debug mode and fallback works.

### Milestone 1: Playable Core Loop
- Implement player movement, enemy chase AI, auto-aim projectile weapon, collisions, HP, death.
- Add XP drops, XP pickup, level progression, and 3-choice level-up modal.
- Add run timer and base HUD.
- Implement first two enemy archetypes tuned for forgiving ramp.

Exit criteria:
- 10–12 minute runs are playable.
- First 3 minutes feel survivable for average keyboard user.
- Game-over/reset cycle is stable.

### Milestone 2: Roguelike Depth Foundation
- Add wave director with time-based spawn escalation and weighted enemy sets.
- Add 8+ upgrade options across offense/survivability/mobility.
- Add deterministic seed support per run (`?seed=`) for repeatability.
- Add pause/state transitions and robust restart flow.

Exit criteria:
- Multiple viable build paths emerge by mid-run.
- Difficulty ramps meaningfully after minute 3.
- No state corruption after pause/resume/restart loops.

### Milestone 3: Performance + Scalability Pass
- Add object pooling for projectiles/enemies/xp.
- Add spatial hash broadphase and capped narrowphase checks.
- Add quality tiers and adaptive VFX scaling based on frame time.
- Add context-loss and tab-visibility recovery paths.

Exit criteria:
- Stable play with high entity density on desktop class hardware.
- No major frame hitching during peak waves.
- Recovery works after tab hide/show and resize.

### Milestone 4: Content Expansion (Post-MVP)
- Add more enemy families and elite variants.
- Add at least one biome/event modifier pass for run variety.
- Add optional meta-progression scaffold (versioned localStorage) behind feature flag.
- Add audio and richer VFX only after performance budget is stable.

Exit criteria:
- Clear replayability increase without architectural rewrites.
- Persistent systems are versioned and migration-safe.

## Public APIs / Interfaces / Types (Important Changes)
- New route: `pages/game/index.html` (publicly reachable).
- New query params:
- `renderer=auto|webgpu|webgl`
- `debug=0|1`
- `seed=<number>`
- New localStorage keys:
- `forestArcana.settings.v1`
- `forestArcana.debug.v1`
- Core type contracts (in `game-src/src/types.ts`):
- `RendererKind = 'webgpu' | 'webgl'`
- `GameConfig`
- `EnemyArchetype`
- `WeaponArchetype`
- `UpgradeOption`
- `WaveStage`
- `RunSnapshot`
- Engine interfaces:
- `IRenderAdapter` for renderer abstraction.
- `ISystem` with `update(dt, world)` lifecycle.
- `IObjectPool<T>` for pooled entity lifecycle.

## Test Cases and Scenarios
### Automated checks
- Typecheck passes for all game TS modules.
- Smoke check confirms:
- homepage has bored-gate element and deep-scroll section id.
- `pages/game/index.html` exists and references built game assets.
- Link checker passes for new route links.
- Unit tests (Vitest) for:
- wave director progression output over time.
- auto-target selection correctness.
- XP/level-up threshold progression.
- collision broadphase candidate filtering.
- RNG seed determinism for spawn order.

### Manual scenarios
- Chrome stable: WebGPU path selected and playable.
- Firefox/Safari: WebGL fallback selected and playable.
- Unsupported environment: friendly failure UI, no crash.
- Resize window repeatedly during combat.
- Pause/resume while enemies/projectiles active.
- Run to death, restart immediately, repeat 5 times without leaks.
- Reduced-motion preference: heavy motion effects disabled.
- Keyboard-only flow from homepage scroll to full run lifecycle.

### Performance acceptance
- Maintain smooth frame pacing at late-wave density target for desktop-first baseline.
- No long-frame spikes during level-up modal open/close.
- No continuous memory growth across back-to-back runs.

## Assumptions and Defaults
- No backend services are required for MVP.
- No multiplayer in current plan.
- No persistent meta progression in MVP.
- No mobile touch controls in MVP (desktop-first by decision).
- No nav/footer discoverability path beyond the deep “Bored?” button.
- Visual theme stays Forest Arcana using site palette and motifs.
- Audio is deferred until core loop and performance are stable.
- Deployment remains static-site compatible; game output is build-generated static assets.
