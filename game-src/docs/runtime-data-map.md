# Forest Arcana Runtime Data Map

This file documents which data paths actively drive runtime gameplay versus legacy/test-only paths.

## Runtime-critical

- `src/core/world.ts`
- `src/systems/runtimeSystem.ts`
- `src/systems/spawnSystem.ts`
- `src/systems/levelSystem.ts`
- `src/systems/collisionSystem.ts`
- `src/systems/autoAttackSystem.ts`
- `src/data/director.ts`
- `src/data/enemies.ts`
- `src/data/weapons.ts`
- `src/data/catalysts.ts`
- `src/data/evolutions.ts`
- `src/data/events.ts`

## Legacy/test-only paths

- `src/data/waves.ts`
- `src/systems/spawnPlanner.ts`

Notes:
- Wave/spawn-planner paths are deterministic fixtures used by tests and seeded planning helpers.
- Live runtime enemy spawning is controlled by `spawnSystem` + `director` + `enemies`, not by `waves.ts`.

## Progression modules

- `src/core/progression.ts` is runtime-critical (`world.ts` level thresholds).
- `src/core/metaProgression.ts` is currently out of the active run loop and must remain behind its explicit feature flag storage gate (`forestArcana.meta.enabled.v1`) before any runtime integration.

If `waves.ts` or `spawnPlanner.ts` are promoted back into gameplay, update this map and add integration tests to avoid drift with live archetype IDs.
