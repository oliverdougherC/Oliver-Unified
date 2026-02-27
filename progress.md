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
