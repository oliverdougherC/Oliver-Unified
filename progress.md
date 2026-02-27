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
