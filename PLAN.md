# Star Forge — Feature Expansion Plan

## Status

- [x] **Phase 0:** Bugfix — Queue lost on refresh (beforeunload + save-after-action)
- [x] **Phase 1.1:** Storage Capacity UI (value/cap display, near-cap warning)
- [x] **Phase 1.2:** Defences (8 types, shared shipyard queue, migration v1→v2)
- [x] **Phase 1.3:** Unlimited Build Queue (array queues, cascading cancel, migration v2→v3)
- [ ] **Phase 2.1:** Galaxy / Colonization
- [ ] **Phase 2.2:** NPC Raids on Player
- [ ] **Phase 2.3:** Player Raids on NPC Colonies

---

## Phase 2: Galaxy & Combat (design, not yet implemented)

### 2.1 Galaxy / Colonization

**State refactor:** `state.planet` → `state.planets: PlanetState[]` + `activePlanetIndex`. Each planet gets `coordinates: { galaxy, system, slot }`. Research stays global.

**New concepts:**
- `GalaxyState` with seed + `NPCColony[]` (procedurally generated)
- Galaxy panel showing system view (15 slots), navigate between systems
- Planet switcher component in header
- Colonization: send colony ship to empty slot, ship consumed, new planet created

**New files:** `src/data/galaxy.ts`, `src/engine/GalaxyEngine.ts`, `src/models/Galaxy.ts`, `src/panels/GalaxyPanel.tsx`, `src/components/PlanetSwitcher.tsx`

**Migration:** v3 → v4

**Risk:** `state.planet` → `state.planets[i]` refactor touches nearly every engine function and panel. Do as a dedicated sub-step.

### 2.2 NPC Raids on Player

**New file:** `src/engine/CombatEngine.ts` — OGame-style round-based combat (max 6 rounds, rapid-fire, 70% defence rebuild).

- `nextRaidAt` timestamp in GameState, checked each tick
- Attacker fleet scales with player's total military power
- Combat log (`combatLog: CombatLogEntry[]`) shown in Messages panel
- Offline processing: simulate raids that occurred during offline window

### 2.3 Player Raids on NPC Colonies

**New file:** `src/engine/FleetEngine.ts` — fleet dispatch, travel time, mission lifecycle.

- `FleetMission` objects track outbound → combat → returning → completed
- Travel time from OGame distance formula + drive tech
- Fuel (deuterium) consumed on departure
- Fleet panel enhanced to show active missions with countdowns

**Migration:** v4 → v5 (add combatLog, nextRaidAt, fleetMissions)

---

## Key Architecture Notes (for Phase 2)

- **Coordinate system:** `{ galaxy: number, system: number, slot: number }` — 1 galaxy, ~50 systems, 15 slots
- **NPC colonies:** Procedurally generated from seed, strength scales with distance from homeworld
- **Combat engine:** Pure function, OGame-style rounds (max 6), rapid-fire system, 70% defence rebuild chance
- **Fleet missions:** Track lifecycle: outbound → at_target → returning → completed
- **Offline processing:** Must handle raids + fleet arrivals chronologically during catch-up
