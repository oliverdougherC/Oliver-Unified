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

## 2026-03-02 forest arcana stabilization + qol/visual pass

### Implementation update (in progress)

- Phase 1 stability/correctness:
  - Fixed `NumericIdPool.reset()` to restore `next` to constructor `start` (`src/core/objectPool.ts`).
  - Added explicit budget evaluation cadence in renderer (`lastBudgetEvalAt`) so percentile work is throttled even when tier does not change (`src/render/pixiRenderAdapter.ts`).
  - Added safe storage wrappers in settings runtime (`safeGetItem`, `safeSetItem`) and routed parse/load/save through them (`src/runtime/settings.ts`).
  - Added `debugOverlayEnabled` to settings payload (v3-compatible default false).
  - Fixed chest guarantee behavior:
    - guaranteed chests now force evolution offers when candidates exist, independent of minute-8 gate.
    - fallback copy now uses "Guaranteed premium reward" language when no evolution candidate exists.
  - Replaced modal choice `innerHTML` with explicit `strong` + `span` text nodes (`src/main.ts`).

- Phase 2 gameplay/QOL:
  - Added `GameWorld.applyPostModalGrace(seconds, includeHazards = true)` and applied:
    - 0.75s contact + hazard grace after level/chest selections.
    - 0.5s contact-only grace when closing settings and resuming play.
  - Added level-up interruption gate:
    - cooldown timer + XP buffer (`levelUpCooldown`, `levelUpXpGate`) to prevent immediate re-pop modals.
  - Added keyboard shortcuts:
    - `R` = restart same seed
    - `N` = new random seed
  - Tuned early difficulty:
    - softer first two director bands in `src/data/director.ts`.
    - reduced touch damage on early archetypes in `src/data/enemies.ts`.

- Phase 3 visual/QOL polish:
  - Improved player/readability emphasis:
    - stronger player stroke, close-threat enemy highlight, and proximity alpha/scale boost in renderer.
  - Tuned painterly clarity defaults:
    - lower default background density/atmosphere and layered fog defaults.
    - reduced non-competitive saturation in WebGPU grading.
  - Improved low-HP signaling with edge-only shell overlay and stronger HUD danger pulse.
  - Improved modal backdrop/panel legibility and card text contrast.
  - Added settings checkbox for debug overlay persistence (`index.html`, `main.ts`).

- Phase 4 data hygiene:
  - Aligned legacy wave weights to live enemy ids (`thorn_guard` instead of stale ids) in `src/data/waves.ts`.
  - Added `game-src/docs/runtime-data-map.md` documenting runtime-critical vs legacy/test-only tables/paths.

### Tests added/updated (pending run)

- Added: `tests/objectPool.test.ts`
- Added: `tests/render-budget.test.ts`
- Added: `tests/chest-guarantee.test.ts`
- Added: `tests/main-modal-safety.test.ts`
- Updated: `tests/settings-runtime.test.ts`
- Updated: `tests/waves.test.ts`

### Next steps

- Run `npm run game:check` and fix any compile/test failures.
- Run `npm run smoke`.
- Run Playwright gameplay probe and inspect screenshots/state/console for regressions in grace windows, restart hotkeys, and visual readability.

### Verification update

- `npm run game:check`: passing (19 files / 41 tests).
- `npm run smoke`: passing.
- `npm run game:build`: passing; updated `pages/game/assets` bundle.

### Playwright probe update

- Launched `npm run game:dev -- --host 127.0.0.1 --port 4173` and validated via Playwright MCP against `http://127.0.0.1:4173/`.
- Verified runtime behavior:
  - `R` restarts same-seed run.
  - `N` rerolls seed (validated via debug seed value change).
  - Post-level-up grace window prevented immediate HP loss in short window test (`hpBefore === hpShortlyAfter` over first 120ms).
  - Settings close/resume path transitions through `paused -> playing` and applies contact grace hook without regressions.
- Console gate:
  - `browser_console_messages(level=error)` returned zero error messages after probe interactions.
- Captured screenshots:
  - Boot (clean defaults): `var/folders/l3/kq0r_qb136zdny5w_13ytp6w0000gn/T/playwright-mcp-output/1772468843561/page-2026-03-02T17-07-09-369Z.png`
  - Level-up modal: `var/folders/l3/kq0r_qb136zdny5w_13ytp6w0000gn/T/playwright-mcp-output/1772468843561/page-2026-03-02T17-04-43-683Z.png`
  - Combat pressure (paused capture): `var/folders/l3/kq0r_qb136zdny5w_13ytp6w0000gn/T/playwright-mcp-output/1772468843561/page-2026-03-02T17-06-14-578Z.png`
  - Game-over modal: `var/folders/l3/kq0r_qb136zdny5w_13ytp6w0000gn/T/playwright-mcp-output/1772468843561/page-2026-03-02T17-05-10-640Z.png`
- Chest modal screenshot was not reached in short deterministic probes (elite cadence + early deaths); chest logic is covered by new unit tests.

### Additional survivability tuning pass

- Deterministic movement probe after first tuning pass still ended at ~97.7s (below 2-3m target).
- Applied an additional early-run forgiveness pass:
  - `src/core/world.ts`: increased base HP to 210, increased base contact invulnerability to 0.48s, added light baseline regen (0.35/s).
  - `src/data/director.ts`: further reduced awakening/wild_hunt enemy/threat envelopes and increased base spawn intervals.
  - `src/systems/spawnSystem.ts`: slowed pressure-blended spawn cadence (`lerp(1.32, 0.7, pressureBlend)`).
- Re-ran `npm run game:check` (passing) and deterministic movement probe.
- Updated probe result:
  - Survived `188.23s` (~3.1m), level 10, no console errors.
  - This meets the "more forgiving first two minutes" target window for deterministic movement choreography.
- Post-tuning verification rerun:
  - `npm run smoke`: passing.
  - `npm run game:build`: passing.

## 2026-03-02 HUD sizing fix

- Fixed oversized HP/Level/Enemies indicator pills caused by HUD row stretching in mixed-wrap layouts.
- CSS updates in `game-src/src/styles.css`:
  - Added `align-items: start` on `.hud` to prevent grid-item stretch to tallest row content.
  - Added `align-items: flex-start` on `.hud-left, .hud-right`.
  - Added `align-items: center`, `flex: 0 0 auto`, and `white-space: nowrap` on `.hud-chip` to preserve compact intrinsic sizing.
- Verification:
  - `npm run game:check` passed (19 files / 41 tests).
  - Browser probe at `http://127.0.0.1:4173/` confirmed HP/Level/Enemies chip heights remain compact (~32.5px) across widths `826`, `760`, `680`, `620`.

## 2026-03-02 restart + rendering clarity fix

- Investigated unexpected run restarts: `world.resetRun()` is only called from `startRun()` in `main.ts`, and restart was bound directly to `r`/`n` keydown globally.
- Added guardrails on restart shortcuts in `game-src/src/main.ts`:
  - New helper `isEditableTarget()` for input/select/textarea/contenteditable detection.
  - `R`/`N` shortcuts now require no modifiers (`meta/ctrl/alt`), non-repeating keydown, and non-editable event target.
  - This prevents accidental restarts from key-repeat and browser-modified combos.
- Improved renderer sharpness setup in `game-src/src/render/pixiRenderAdapter.ts`:
  - Set Pixi init to `autoDensity: true` with DPI-aware `resolution` (`clamp(devicePixelRatio, 1, 2)`).
  - Kept `antialias: true`.

### Verification

- `npm run game:check` passed (19 test files / 41 tests).
- Browser probe on `http://127.0.0.1:4173`:
  - Synthetic `keydown` with `{ key: 'r', repeat: true }` no longer restarted.
  - Synthetic `keydown` with `{ key: 'r', ctrlKey: true }` no longer restarted.
  - Plain `keydown` with `{ key: 'r' }` still restarts as intended.
- WebGL context probe (`?renderer=webgl`) reports `antialias: true` via `getContextAttributes()`.

## 2026-03-02 visual fidelity pass (user feedback: rough edges)

- Applied a high-fidelity rendering pass to prioritize visual quality over dynamic downscaling.

### Changes

- `game-src/src/main.ts`
  - Disabled automatic quality auto-downgrade logic in `chooseQuality` (quality now user-driven/stable at runtime).
  - Start runs with `world.setQuality('high')` to avoid legacy persisted low-quality sessions.

- `game-src/src/render/pixiRenderAdapter.ts`
  - Increased DPI render resolution cap from `2` to `3` (`resolution = clamp(devicePixelRatio, 1, 3)`).
  - Kept `antialias: true` and `autoDensity: true`.
  - Reduced blur/grain softness:
    - WebGL fx blur strength `1.1 -> 0.7`.
    - WebGPU fx blur strength `1.8 -> 1.1`.
    - WebGPU noise `0.04 -> 0.018`.
  - Kept quality-high budget from collapsing to low tiers (`quality === 'high'` now clamps budget target to `high/ultra`).

- `game-src/src/render/enemySpriteFactory.ts`
  - Reworked roughest enemy body silhouettes to smoother curved forms (charger/sniper/summoner/bruiser) while preserving role identity markers.

- `game-src/tests/render-budget.test.ts`
  - Updated test setup to set `quality='medium'` so cadence assertion remains valid under new high-quality clamping policy.

### Verification

- `npm run game:check` passed (19 files / 41 tests).
- Browser probe (`http://127.0.0.1:4173`):
  - `render_game_to_text` reported `quality: "high"`, `budgetTier: "ultra"`.
  - Canvas backing ratio observed at `2x` in probe environment (`width: 2560`, `clientWidth: 1280`).
  - WebGL context attributes report `antialias: true`.
  - Console error check returned 0 errors.
- Gameplay screenshot after pass:
  - `var/folders/l3/kq0r_qb136zdny5w_13ytp6w0000gn/T/playwright-mcp-output/1772468843561/page-2026-03-02T17-31-52-177Z.png`

## 2026-03-02 visual quality overhaul continuation (massive pass)

### Implementation update

- Continued the desktop-first visual overhaul with a stronger texture + lighting quality pass.
- `src/render/textureBaker.ts`
  - Increased texture bake resolutions (`ultra` now 1536, `high` 1024, `medium` 768, `low` 512).
  - Added high-quality canvas defaults (`lineJoin/lineCap` round, smoothing enabled, high smoothing quality when available).
  - Added explicit texture sampling config on baked textures:
    - `scaleMode = linear`
    - `mipmapFilter = linear`
    - `autoGenerateMipmaps = true`
    - `antialias = true`
    - `maxAnisotropy = 8`
- `src/render/pixiRenderAdapter.ts`
  - Increased AA resolution multipliers (`supersample` 1.8x, `fxaa` profile 1.25x).
  - Tightened post-fx blur so image stays crisp (`supersample` path now no extra blur, lighter WebGPU fog blur).
  - Applied additional grading contrast shaping for cleaner edge separation.
  - Added dynamic enemy texture variant switching at runtime (`base`/`glow`/`elite`) based on threat/hit/windup state.
  - Added light-aware tint mixing for improved rim/readability without flattening palette.
  - Explicitly set canvas CSS rendering to avoid browser downscale artifacts.
- `src/render/painterlyBiomeComposer.ts`
  - Added atmospheric depth color mixing (far cards shift toward fog/grade colors).
  - Added edge feathering pass to reduce card cutout look.
  - Added trunk/root/moss soft contact occlusion underlays for grounding.
  - Added specular-mask-aware highlight usage for richer material response.
  - Added mid-band haze layer for depth continuity.
- `src/render/lightingPipeline.ts`
  - Raised light budgets in high/ultra tiers (`ultra` 72 lights, `high` 56) and increased shadow-light caps.
  - Added rim-shell light stroke around lights for cleaner silhouette definition.
  - Added contact-shadow blob pass from shadow casters.
  - Added layered depth haze bands in fog composition.

### Verification update

- `npm run game:typecheck`: passing.
- `npm run game:test`: passing (21 files / 46 tests).
- `npm run game:check`: passing.
- `npm run smoke`: passing.
- `npm run game:build`: passing; refreshed `pages/game/assets`.

### Browser probe + artifacts

- Validated built game via Playwright MCP using a local static server session (`python3 -m http.server 4173 --directory pages`) and URL `http://127.0.0.1:4173/game/`.
- Console gate: `browser_console_messages(level=error)` reported **0 errors**.
- `render_game_to_text` probe snapshot confirmed:
  - `visualSettings.textureDetail = "ultra"`
  - `visualSettings.edgeAntialiasing = "supersample"`
  - `visualSettings.desktopUltraLock = true`
  - `quality = "high"`, `renderPerf.budgetTier = "ultra"` in sampled states.
- Captured screenshots:
  - `output/web-game-ultra-pass-shot-1.png` (combat HUD + baseline)
  - `output/web-game-ultra-pass-shot-2-levelup.png` (level-up legibility)
  - `output/web-game-ultra-pass-shot-3-levelup2.png` (level-up variant)
  - `output/web-game-ultra-pass-shot-4-combat.png` (combat after upgrades)
  - `output/web-game-ultra-pass-shot-5-settings.png` (runtime settings panel)

### Remaining follow-up

- If we want an even larger leap next pass: add a true full-scene offscreen supersample composite pass and optional shader FXAA filter path (current pass uses higher-resolution AA scaling and sharpened post stack).

## 2026-03-02

### Performance + clarity recovery pass

- Added runtime settings/query support for `resolutionProfile`, `resolutionScale`, and `postFxSoftness`.
- Added render perf snapshot fields for `pixelCount`, `targetResolution`, `backdropChunkCount`, and `backdropCardsDrawn` and surfaced them in debug overlay.
- Reworked renderer resolution policy to capability-based scaling/caps (desktop/mobile-like caps) with balanced-by-default profile behavior.
- Reduced default softness/haze contributions for sharper balanced output and preserved cinematic softness for explicit cinematic/quality modes.
- Added painterly backdrop cache eviction and visible-window iteration; added backdrop redraw throttling for stable camera periods.
- Updated lighting pipeline to bounded top-K light selection, low-light tile-assignment skip, and reduced fog/shadow cadence under stable camera.
- Added/updated tests: settings runtime fields/parsing, painterly cache bounds, and lighting top-priority selection.
- Added `scripts/game-perf-gate.js` and `npm run game:perf` for idle/move/combat scenarios with p95, clarity, and backdrop-drift thresholds.

### Verification status

- `npm run game:typecheck` passes.
- `npm run game:test` passes (22 files / 48 tests).
- `npm run game:perf -- --url http://127.0.0.1:5173/game-src/ --quick` fails in this sandbox due Playwright Chromium launch permission (`mach_port_rendezvous` / permission denied), not due app logic.

### 2026-03-02 Safari recovery implementation update

- Implemented renderer/runtime API additions:
  - `rendererPolicy: 'auto' | 'prefer_webgl' | 'prefer_webgpu'`
  - `safariSafeMode: boolean`
- Added perf telemetry fields to render snapshot:
  - `updateMs`, `updateSteps`, `backdropDrawCommandsEstimate`, `lightingSampleCount`, `actualCanvasToCssRatio`
- Added query parsing support for `rendererPolicy` and `safariSafeMode` with backward-compatible defaults.
- Updated loop resilience:
  - Added max substep cap (`maxSubSteps`, default `3`) and accumulator drop under sustained stalls.
- Updated renderer initialization policy:
  - Safari-safe mode now prefers WebGL first for `renderer=auto` on Safari-like UAs.
- Reduced default pixel pressure:
  - Removed FXAA upscaling effect from resolution selection path.
  - Added safe-mode caps (`desktop-like 1.75`, `mobile-like 1.5`).
- Added clarity guard:
  - If backing ratio drops below expected target, expensive non-essential effects are disabled before further resolution stress.
- Backdrop optimization pass:
  - Wired `parallaxBackdrop` budget flag into real behavior.
  - `minimal` path now draws static gradient bands only.
  - `low`/`medium` tiers use stricter redraw cadence and hard card caps.
  - Added time-sliced chunk generation (`chunkBuildBudget`) and command estimate metric.
- Lighting optimization pass:
  - Added per-frame sampling grid (`prepareSamplingGrid`) to avoid repeated full light scans in per-entity loops.
  - Added Safari-safe budget scaling and stronger fog/shadow cadence throttling.
- Updated tests:
  - `settings-runtime.test.ts` covers new settings/query fields.
  - `render-budget.test.ts` now includes fixed-loop catch-up cap test.
  - `painterly-biome-composer.test.ts` includes card-cap assertion and command metric sanity.
  - `lighting-pipeline.test.ts` covers sampling grid + sample counter.
- Updated perf gate script:
  - Added `safari_safe_profile` scenario.
  - Added gating for update-step pressure and backdrop command drift.

Validation:
- `npm run game:typecheck` ✅
- `npm run game:test` ✅ (22 files / 50 tests)
- `npm run game:build` ✅
- `npm run game:perf -- --url http://127.0.0.1:5173/game-src/ --quick` ❌ blocked in this sandbox by Chromium launch permission (`mach_port_rendezvous` permission denied).
- Additional post-implementation runtime probe executed via Playwright MCP against `http://localhost:5174/game-src/?renderer=auto&rendererPolicy=prefer_webgl&safariSafeMode=1`:
  - Renderer selected: `webgl`.
  - Target resolution average: `1.75` (safe cap path), canvas ratio average: `~1.75`.
  - `updateSteps` p95 observed: `1`.
  - Backdrop command estimate average sampled in this short run: `~4958`.
- Captured verification screenshot: `output/safari-safe-verify.png`.
- No browser console errors observed in this probe.
- Skill client command attempt (`$WEB_GAME_CLIENT`) still fails in this environment due module resolution (`ERR_MODULE_NOT_FOUND: playwright`) from the skill directory.

## 2026-03-02 startup pop-in + mortar fairness follow-up

### User-reported issues

- Startup visual pop-in was still noticeable as backdrop assets streamed in.
- Midgame hostile mortar/spit behavior felt unavoidable and too punishing.

### Implemented fixes

- Backdrop prewarm path:
  - Added `PainterlyBiomeComposer.prewarm(cameraX, cameraY)` and deterministic near-to-far chunk coverage ordering.
  - Added startup full-coverage build in `ensureChunkCoverage` before returning to normal per-frame budgeted chunk builds.
  - Wired renderer prewarm hook (`prewarmVisualAssets`) to call backdrop prewarm at run boot.
- Spitter fairness pass (`EnemyAISystem`):
  - Replaced perfect lock-on spit with intentionally imperfect aim (light prediction + guaranteed angular spread).
  - Added close-range no-fire gate to prevent point-blank unavoidable spit.
  - Added pressure throttling: if hostile projectile/hazard counts are already high, spitters defer shots instead of saturating.
  - Increased post-shot cooldown scaling under pressure to limit runaway projectile spam.
- Spitter tuning pass (`data/enemies.ts`):
  - Reduced projectile speed, hazard radius, hazard duration, and hazard DPS across spitter archetypes.
  - Increased cooldowns to reduce unavoidable overlap bursts (including elite shard witch).
- Spawn fairness tweak (`core/world.ts`):
  - Raised initial spitter cooldown window at spawn so newly spawned spitters are less likely to fire almost immediately.

### Verification

- `npm run game:test` passed (`23` files / `54` tests).
- Added tests:
  - `game-src/tests/enemy-ai-system.test.ts` (aim variance, pressure throttling, close-range no-fire).
  - `game-src/tests/painterly-biome-composer.test.ts` startup prewarm assertion.
- `npm run game:typecheck` passed.
- `npm run game:build` passed.

### Follow-up suggestions

- If mortar pressure still feels high in real Safari sessions, next tuning lever is lowering `projectileCap`/`hazardCap` in `EnemyAISystem` by another 1-2 each for `>180s` bands.
- Optional UX improvement: add a short ground telegraph fade-in before hazard activation for enemy spit impacts.
- Attempted skill-mandated `$WEB_GAME_CLIENT` Playwright run on 2026-03-02 after this patch; blocked by missing `playwright` package in skill script environment (`ERR_MODULE_NOT_FOUND`). Retained verification via unit tests + typecheck + build.
