Original prompt: What is the next logical step for our game. I want to make the game more complex, and harder. I also want to make it much more visually impressive and make use of some of WebGPU's features. Please refer to the PLAN.md file

## 2026-02-20

- Started Milestone 5 vertical slice implementation in `game-src`.
- Focus: behavior-driven enemies, persistent hazards, threat-budget spawn composition, and stronger WebGPU-forward rendering effects.
- Located `PLAN.md` in sibling path `/Users/ofhd/Developer/websites/chc_web/PLAN.md` and used it as the planning baseline.

### TODO (in progress)

- Add dash + ranged enemy behaviors and corresponding data model.
- Add enemy projectile and hazard entity flows (spawn, collide, expire, render).
- Add telegraph visuals + impact FX with richer WebGPU path and safe WebGL fallback.
- Add deterministic testing hooks (`window.render_game_to_text`, `window.advanceTime`).
- Run `game:check` and Playwright loop; fix any regressions.

### Progress update

- Implemented enemy behavior states in world model (`chaser`, `dash_striker`, `spitter`) with runtime dash/spit cooldown tracking.
- Added new combat entities:
  - enemy projectiles with hazard-on-impact/expiry payloads.
  - persistent hazard pools with timed damage ticks.
- Added two new archetypes in enemy data:
  - `briar_lancer` (dash telegraph -> burst engage).
  - `spore_channeler` (ranged toxic lobber creating area denial).
- Reworked wave data with `threatCap` and updated compositions to include behavior enemies later in runs.
- Updated spawn system to use threat-aware composition instead of pure count pressure.
- Expanded renderer:
  - enemy projectile + hazard rendering.
  - dash telegraph rendering.
  - stronger overlay/impact effects.
  - WebGPU-only post effects (noise grading + heavier atmospheric pass).
- Added test hooks in game runtime:
  - `window.render_game_to_text()`
  - `window.advanceTime(ms)`

### Verification update

- `npm run game:check` passes (typecheck + 15 vitest tests).
- `npm run game:build` succeeds; deploy bundle refreshed under `pages/game/assets`.
- Playwright skill client executed (using installed Chromium) with multiple action profiles:
  - `output/web_actions.json`
  - `output/web_actions_long.json`
  - `output/web_actions_probe.json`
- No new console/page errors detected in captured runs.
- Probe run confirmed late-run combat entities and hazards:
  - Observed `spore_channeler` states.
  - Observed active enemy projectiles (`counts.enemyProjectiles > 0`).
  - Observed persistent hazards (`counts.hazards > 0`) with multiple concurrent pools.
  - Example capture: `output/web-game-probe2/state-45.json` at ~156.78s includes both enemy projectiles and hazards.

## 2026-02-27

### Chaos overhaul implementation (in progress)

- Replaced the old single-weapon data model with a new item ecosystem:
  - Added `WEAPON_ARCHETYPES` (8 base + 6 evolutions) in `game-src/src/data/weapons.ts`.
  - Added catalysts in `game-src/src/data/catalysts.ts`.
  - Added evolution recipes in `game-src/src/data/evolutions.ts`.
- Expanded enemy content and roles in `game-src/src/data/enemies.ts` (12 archetypes including elites).
- Added director band data in `game-src/src/data/director.ts` for chaos pressure targets.
- Reworked run events to new chaos windows (`blood_monsoon`, `iron_canopy`, `void_howl`).
- Rewrote `types.ts` with inventory/chest/director/item interfaces and compatibility legacy types.
- Rewrote `core/world.ts`:
  - 4-slot inventory + catalyst ranks.
  - level-up choices and chest choices.
  - evolution candidate logic and chest reward/evolution flow.
  - per-slot weapon cooldown model and projectile spawn config.
  - damage burst cap + armor mitigation.
  - chest entities and director runtime state.
- Rewrote major systems:
  - `levelSystem.ts` now generates 3-choice slot/catalyst/stat offers.
  - `autoAttackSystem.ts` now runs all equipped weapons with multiple attack patterns.
  - `spawnSystem.ts` now uses intensity/heat director and role-aware composition + elite cadence.
  - `runtimeSystem.ts` now updates chest lifecycle and pickup flow.
  - `collisionSystem.ts` now handles elite chest drops and crit-aware projectile damage.
  - `projectileSystem.ts` supports hazard-on-expire weapon behavior.
  - `cleanupSystem.ts` now includes chest/projectile culling updates.
- Reworked frontend shell:
  - `game-src/index.html` now includes inventory/catalyst HUD bars and dedicated chest modal.
  - `game-src/src/styles.css` received a new high-contrast, layered visual treatment.
  - `game-src/src/render/pixiRenderAdapter.ts` rewritten with richer backdrop, role-based enemy silhouettes, chest visuals, and stronger combat FX.
  - `game-src/src/main.ts` rewritten around new level-up/chest/gameplay state model and isolated run flow (no meta dependency in run loop).
- Updated and added tests:
  - Updated `events.test.ts` and `runtimeSystem.test.ts` for new events.
  - Added `inventory-levelup.test.ts` and `evolution.test.ts`.

### TODO remaining

- Run `npm run game:check` and fix compile/test regressions from broad refactor.
- Rebuild game bundle (`npm run game:build`) after checks pass.
- Run Playwright action loop + inspect screenshots and state payload for gameplay sanity.
- Tune balance (enemy density, XP pacing, weapon scaling) against chaos targets.

### Verification + tuning update

- Re-ran `npm run game:check` repeatedly after each tuning pass (currently passing: 10 files / 19 tests).
- Re-ran `npm run game:build` successfully; output refreshed under `pages/game/assets`.
- Executed multiple Playwright verification runs against `http://127.0.0.1:4173` with the skill client.
- Final probe folder: `output/web-game-chaos-final`.
  - No `errors-*.json` files emitted.
  - Observed max sampled pressure:
    - `enemies: 20`
    - `enemyProjectiles: 2`
    - `hazards: 7`
    - `level: 5`
    - sampled run time reached `44.28s` before reset/death in test choreography.
- Additional tuning performed after probe feedback:
  - Slowed XP leveling curve to reduce runaway early level cadence.
  - Accelerated enemy unlock schedule and event windows so chaotic mechanics appear sooner in-run.
  - Increased spitter fire cadence to ensure hostile projectile/hazard presence.
  - Raised base player survivability and lowered early enemy touch damage to keep chaos challenging but less unfair.

### Remaining balancing TODOs

- Continue tuning toward target minute-band pressures in sustained manual runs (3-5m and 6-9m windows).
- Validate elite chest cadence/evolution pickup in a longer survival scenario.
- Optional: add deterministic long-run choreography payload focused on survival pathing for better late-game automated coverage.

### Final probe snapshot

- Final Playwright probe directory: `output/web-game-chaos-final`.
- Observed sampled peak in `state-16.json` at `44.28s`:
  - `enemies: 12`
  - `enemyProjectiles: 2`
  - `hazards: 7`
  - `xpOrbs: 18`
- Confirmed no Playwright error files emitted in final probe folder.

## 2026-02-27 (visual/qol/perf overhaul)

### Progress update

- Started implementation of visual/readability/performance-focused overhaul (no gameplay-content rewrite).
- Added new runtime settings model with migration-safe defaults in `game-src/src/runtime/settings.ts`:
  - color vision mode, UI scale, screen shake, hazard opacity, hit flash strength, directional indicators, damage numbers.
- Extended shared interfaces in `game-src/src/types.ts`:
  - visual roles/theme tokens, visual runtime settings, render budget/perf snapshot contracts.
- Refactored `game-src/src/main.ts`:
  - removed per-frame inventory/catalyst DOM rebuild.
  - implemented cached + throttled HUD sync (heavy HUD updates at 10Hz).
  - added readability settings wiring + persistence + debug telemetry hooks.
- Replaced `game-src/src/render/pixiRenderAdapter.ts` with new renderer pipeline:
  - semantic visual palette integration via `render/visualTheme.ts`.
  - camera-anchored parallax backdrop.
  - culling-aware entity sync and distance-sensitive simplification.
  - adaptive render budget tiers and perf snapshot reporting.
  - off-screen elite/chest directional indicators and hazard opacity / hit-flash controls.
- Updated `game-src/index.html` and `game-src/src/styles.css`:
  - stronger bioluminescent contrast styling, low-HP pulse, evolution-ready chip.
  - expanded runtime settings panel for readability controls.
- Added tests:
  - `game-src/tests/settings-runtime.test.ts` for settings migration and query override behavior.
  - `game-src/tests/visual-theme.test.ts` for luminance separation gates.

### Verification status

- `npm run game:typecheck` currently passing after refactor.
- Next: run `npm run game:test`, then Playwright visual run and inspect screenshots/state for regressions.

### Verification update (visual/qol/perf overhaul)

- `npm run game:check` passed after refactor (typecheck + 12 test files / 22 tests).
- `npm run game:build` completed successfully and refreshed `pages/game` assets.
- Attempted Playwright gameplay capture using the skill client and repo-local client, but browser automation could not reach local dev server from this environment (`ERR_CONNECTION_REFUSED` across sandbox/escalated contexts). Kept this as an environment limitation and validated via static checks/build.

### Remaining follow-up

- Re-run gameplay probe/screenshots in an environment where browser runner and dev server share the same network namespace.
- Confirm late-run FPS/visual readability targets with real capture artifacts.

### Follow-up fixes

- Added legacy settings fallback loading (`forestArcana.settings.v2` -> v3 normalization) in runtime settings.
- Expanded settings tests to assert legacy key migration behavior.
- Re-ran `npm run game:test` and `npm run game:check` after migration fix; both passing.

### 2026-02-27 visual art direction follow-up

- Applied deeper renderer art pass based on user feedback ("theme good but visuals still ugly/unclear").
- Upgraded backdrop from soft blobs to richer world-anchored geometry:
  - shard canopy layers, animated ribbons, and rune/hex lattice overlays.
- Upgraded combat glyph clarity:
  - allied projectiles now directional crystal bolts.
  - hostile projectiles now directional wedge spears.
  - hazards now rotating sigils/spokes.
  - dash telegraphs now include filled cone warnings, not just line+ring.
  - XP and chest glyphs gained more ornate geometry.
- Added mild orientation cues on enemy/projectile sprites using velocity-based rotation.
- Re-ran checks:
  - `npm run game:check` passed.
  - `npm run game:build` passed; production assets refreshed.

## 2026-02-27 mystical forest + lighting engine overhaul

### Implementation update

- Added a new visual/lighting API surface:
  - Extended `types.ts` with lighting/runtime settings, material/light/shadow contracts, render pass metrics, and render adapter methods (`setLightingSettings`, `prewarmVisualAssets`, `getRenderPassMetrics`).
  - Extended runtime settings parsing + persistence in `runtime/settings.ts` with migration-safe defaults for:
    - `lightingQuality`, `shadowQuality`, `fogQuality`, `bloomStrength`, `gamma`, `environmentContrast`, `materialDetail`, `clarityPreset`.
- Added new render modules:
  - `render/materialLibrary.ts` for per-role material profiles and light-reactive tinting.
  - `render/forestBiome.ts` for chunked, world-anchored biome geometry (trunks, roots, vines, runes, fungal glow clusters).
  - `render/lightingPipeline.ts` for dynamic light registry, tile assignment, shadow projection, fog composition, and pass timings.
  - shader placeholders under `render/shaders/` (`lighting.wgsl.ts`, `lighting.glsl.ts`).
  - atlas descriptor scaffold under `render/atlas/forestAtlas.ts`.
- Reworked `render/pixiRenderAdapter.ts` integration:
  - Added dedicated shadow/light/fog layers and lighting pass synchronization.
  - Replaced old backdrop generation with chunked `ForestBiomeRenderer`.
  - Added dynamic light + shadow caster collection from player/enemies/hazards/chests/projectiles.
  - Added material-aware enemy tinting via `materialLibrary`.
  - Expanded render perf snapshot with pass metrics + active lights/casters.
  - Wired quality/clarity settings into renderer grading and FX behavior.
- Expanded settings UI:
  - Added controls in `game-src/index.html` and `game-src/src/main.ts` for lighting/shadows/fog/bloom/gamma/contrast/material detail/clarity presets.
  - Added settings panel scrolling support in `styles.css`.
- Added/updated tests:
  - New: `tests/material-library.test.ts`.
  - New: `tests/lighting-pipeline.test.ts`.

## 2026-02-27 painterly reboot v2 execution

### Implementation update

- Implemented Visual Reboot V2 contracts end-to-end:
  - Added new runtime visual fields in `types.ts` + settings runtime model:
    - `sceneStyle`, `combatReadabilityMode`, `enemyOutlineStrength`, `backgroundDensity`, `atmosphereStrength`.
  - Added readability snapshot types and renderer adapter method:
    - `ReadabilityGovernorState`, `SceneSuppressionTier`, `getReadabilitySnapshot()`.
- Added new render modules:
  - `src/render/atlas/painterlyForestAtlas.ts`
  - `src/render/painterlyBiomeComposer.ts`
  - `src/render/enemySpriteFactory.ts`
  - `src/render/readabilityGovernor.ts`
- Refactored `src/render/pixiRenderAdapter.ts`:
  - Replaced old biome backend with `PainterlyBiomeComposer`.
  - Replaced enemy shape generation with `enemySpriteFactory`.
  - Wired `ReadabilityGovernor` with suppression-tier driven atmosphere/background/fog/glow/mote reductions.
  - Added `getReadabilitySnapshot()` and exported governor state into debug and text probe payload.
  - Rebalanced lighting usage to reduce full-screen haze and oversized halos.
  - Reworked damage vignette to edge-band treatment (removed center-dimming ring artifact).
- Updated `src/render/lightingPipeline.ts`:
  - Added readability multiplier hook.
  - Shifted fog from broad screen wash to local pockets.
  - Tightened light footprint/intensity and reduced over-blooming wide radius pass.
- Updated settings/UI:
  - `index.html` + `main.ts` now include controls for:
    - Combat readability mode
    - Enemy outline strength
    - Background density
    - Atmosphere strength
  - Added quick presets:
    - Painterly Balanced
    - Painterly Combat
- Updated visual palette to improve enemy/background separation in `visualTheme.ts` (especially early-wave readability).
- Added tests:
  - `tests/readability-governor.test.ts`
  - Expanded `tests/settings-runtime.test.ts` for new field migration/query behavior.

### Verification update

- `npm run game:check` passes (15 files / 30 tests).
- `npm run game:build` passes; `pages/game/assets` refreshed.
- Playwright probe executed against local dev server with elevated browser permission:
  - Command used repo client: `output/web_game_playwright_client.js`
  - Output folder: `output/web-game-painterly-v2`
  - Captured screenshots: `shot-0.png` .. `shot-5.png`
  - Captured state snapshots: `state-0.json` .. `state-5.json`
  - `render_game_to_text` now includes readability governor snapshot (`threatLevel`, suppression tier, applied overrides).

### Remaining TODOs

- Painterly assets are now coherent/readable but still stylized/procedural; if needed, push to a richer authored atlas pass for more bespoke forest set pieces.
- Add contrast assertions for enemy-vs-local-backdrop (runtime guard currently enforces via palette/outline strategy, not a strict local luminance sampler).
  - Updated: `tests/settings-runtime.test.ts` for new settings fields/query overrides.
  - Updated: `tests/visual-theme.test.ts` threshold for new dark palette balancing.

### Verification update

- `npm run game:typecheck`: passing.
- `npm run game:test`: passing (14 files, 28 tests).
- `npm run game:check`: passing.
- `npm run game:build`: passing and refreshed `pages/game/assets`.
- Playwright probe runs executed (escalated environment):
  - `output/web-game-lighting`
  - `output/web-game-lighting-long`
  - `output/web-game-lighting-smoke`
  - No `errors-*.json` files generated in probe directories.
  - `render_game_to_text` now includes non-zero lighting pass timing buckets (`renderPerf.passes`).

### Remaining follow-up tuning

- Visual quality remains significantly darker than desired in some sampled states; tune:
  - base ambient floor light and fog opacity curve,
  - early-run contrast and silhouette brightness,
  - budget-tier downgrade aggressiveness (frequent `minimal` tier in probe timings).
- Increase late-run probe choreography coverage to guarantee hazard/projectile-heavy scenes for richer lighting validation.

### 2026-02-27 readability hotfix pass

- Addressed user feedback about washed-out transparency and poor enemy/background separation:
  - Reduced background visual density and alpha in `render/forestBiome.ts` (fewer props/chunk, lower prop opacity, lighter event tint).
  - Reduced fog/shadow wash and removed center carve ring in `render/lightingPipeline.ts`.
  - Reduced large ambient circle spill from lighting pass and removed orbiting ambient lights in `render/pixiRenderAdapter.ts`.
  - Boosted enemy silhouette readability:
    - added dark underlay disk in `createEnemyGraphic`.
    - increased enemy stroke width/base opacity and disabled dynamic dark tinting.
    - brightened enemy palette values in `render/visualTheme.ts`.
- Verification:
  - `npm run game:check` passing.
  - `npm run game:build` passing.
  - New screenshot probe outputs:
    - `output/web-game-contrast-pass`
    - `output/web-game-contrast-pass-2`
