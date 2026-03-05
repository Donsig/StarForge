# Star Forge — Feature Expansion Plan

## Status

- [x] **Phase 0:** Bugfix — Queue lost on refresh (beforeunload + save-after-action)
- [x] **Phase 1.1:** Storage Capacity UI (value/cap display, near-cap warning)
- [x] **Phase 1.2:** Defences (8 types, shared shipyard queue, migration v1→v2)
- [x] **Phase 1.3:** Unlimited Build Queue (array queues, cascading cancel, migration v2→v3)
- [x] **Phase 2.1:** Galaxy / Colonization (state refactor, GalaxyEngine, GalaxyPanel, PlanetSwitcher, v3→v4)
- [x] **Phase 2.1b:** Multi-planet bugfixes (production, offline, determinism)
- [ ] **Phase 2.2:** Combat Engine + NPC Planet Simulation (v4→v5)
- [ ] **Phase 2.3:** Fleet Dispatch + Player Raids on NPCs (v5→v6)
- [ ] **Phase 2.4:** Espionage System (v6→v7)
- [ ] **Phase 2.5:** Admin Dashboard (dev tools: add resources, force colonize, trigger combat, instant travel)
- [ ] **Phase 3.1:** Debris Fields + Recycler Missions
- [ ] **Phase 3.2:** Economy Polish (colony caps, slot-based planets, transport, solar satellites)
- [ ] **Phase 3.3:** Messages Panel + Combat Reports
- [ ] **Phase 3.4:** UI Polish (planet rename, IRN, fleet slots)

---

## Phase 2.1b: Multi-Planet Bugfixes

Known bugs introduced by the multi-planet refactor that must be fixed before combat phases.

### Bug: Non-active planets produce nothing

`ResourceEngine.processTick` and `accumulateBulk` only operate on `activePlanet`. All other colonies sit idle. Fix: iterate over all `state.planets` in the tick loop, accumulating resources for each.

### Bug: Offline catch-up only processes one planet

`StateManager.processOfflineTime` runs queue completions and resource accumulation for the active planet only. Fix: process all planets' queues chronologically during catch-up.

### Bug: `colonize()` uses `Math.random()` instead of seeded PRNG

Temperature assignment in `GalaxyEngine.colonize()` calls `Math.random()`, breaking determinism. Fix: use the seeded PRNG from galaxy state.

### Bug: NPC strength doesn't scale with distance

`generateNPCColonies` uses flat `rng() * 100 + 10` for military power. The plan said strength should scale with distance from the player's homeworld. Fix: compute distance from homeworld coordinates and scale accordingly.

---

## Phase 2.2: Combat Engine + NPC Planet Simulation

### Overview

Player raids NPC-inhabited planets. No inbound NPC raids. Combat engine is a pure function; fleet dispatch UI comes in Phase 2.3.

---

### CombatEngine (`src/engine/CombatEngine.ts`)

Pure, deterministic function — takes explicit `seed: number`, no internal `Math.random()` calls.

```ts
function simulate(
  attacker: { ships: Record<ShipId, number>; techs: AttackerTechs },
  defender: { ships: Record<ShipId, number>; defences: Record<DefenceId, number>; techs: DefenderTechs },
  seed: number,
): CombatResult
```

**Round structure (max 6 rounds, both sides fire simultaneously):**
1. All attacker units fire at random defender units
2. All defender units fire at random attacker units
3. Both volleys resolve simultaneously
4. Shields reset to full for next round
5. Check end: one side eliminated → win; 6 rounds survived → draw (attacker retreats)

**Damage model:**
- Shields absorb damage first (up to shield value)
- Excess damage goes to hull (structural integrity)
- Unit destroyed when hull ≤ 0
- **1% rule:** if `attack < 0.01 * targetShield`, deal 0 damage (shot deflected)
- **<70% hull explosion:** when a unit's hull drops below 70%, each subsequent hit has a `(1 - hull/maxHull)` chance to instantly destroy it

**Rapid-fire (`src/data/combat.ts` — RF table only, no stat duplication):**
- Combat stats (`shield`, `attack`, `hull`) added directly to existing records in `src/data/ships.ts` and `src/data/defences.ts`
- RF procs on target type; follow-up shot selects **randomly from ALL enemies** (not just same type), and can chain if the new target also triggers RF
- Chance to fire again: `(n-1)/n` where `n` is the RF value

**Full rapid-fire table:**

| Attacker | Target | RF |
|----------|--------|----|
| Cruiser | Light Fighter | 6 |
| Cruiser | Rocket Launcher | 10 |
| Battleship | Espionage Probe | 5 |
| Bomber | Rocket Launcher | 20 |
| Bomber | Light Laser | 20 |
| Bomber | Heavy Laser | 10 |
| Bomber | Ion Cannon | 10 |
| Destroyer | Light Laser | 10 |
| Battlecruiser | Small Cargo | 3 |
| Battlecruiser | Large Cargo | 3 |
| Battlecruiser | Light Fighter | 4 |
| Battlecruiser | Heavy Fighter | 4 |

**Post-combat:**
- 70% of destroyed defence units rebuild (free, instantaneous) — ships are permanently lost
- Debris = 30% metal + 30% crystal cost of ALL destroyed ships (both sides); NOT defences
- Debris accumulates into existing `DebrisField` at the same coordinates (one field per coordinate)

**`CombatResult` interface (complete — designed for Phase 3.3 battle reports):**
```ts
interface CombatResult {
  seed: number;
  outcome: 'attacker_wins' | 'defender_wins' | 'draw';
  rounds: number;
  attackerStart: UnitSnapshot;      // ships at battle start
  attackerEnd: UnitSnapshot;        // ships surviving
  defenderStart: UnitSnapshot;      // ships + defences at battle start
  defenderEnd: UnitSnapshot;        // ships + defences surviving
  attackerLosses: UnitSnapshot;
  defenderLosses: UnitSnapshot;
  defencesRebuilt: Partial<Record<DefenceId, number>>;
  debrisCreated: { metal: number; crystal: number };
  loot: { metal: number; crystal: number; deuterium: number };
}

type UnitSnapshot = {
  ships: Partial<Record<ShipId, number>>;
  defences?: Partial<Record<DefenceId, number>>;
};
```

---

### NPC Planet Simulation

NPC planets simulate players at random progress tiers. State stored in `GameState.galaxy.npcColonies`.

**Model (`src/models/Galaxy.ts`):**
```ts
interface NPCColony {
  coordinates: Coordinates;
  name: string;
  tier: number;                              // 1–10, seed-derived, scales with distance
  buildings: Record<BuildingId, number>;    // derived at generation, static (NPCs don't build)
  baseDefences: Record<DefenceId, number>; // full-strength baseline (from tier)
  baseShips: Record<ShipId, number>;       // full-strength baseline (from tier)
  currentDefences: Record<DefenceId, number>; // actual post-combat survivors
  currentShips: Record<ShipId, number>;       // actual post-combat survivors
  lastRaidedAt: number;                       // 0 = never raided (at full strength)
}
```

**Resources (on-demand, never stored):**
```ts
function getNPCResources(colony: NPCColony, now: number): Resources
// = production_rate(colony.buildings) × elapsed_hours_since_lastRaidedAt
// capped at 48hr stockpile equivalent
```

**Rebuild (on-demand interpolation):**
- Defences and fleet recover linearly from `current → base` over 48 hours
- Queried at raid time: `current + (base - current) * Math.min(1, elapsed / (48 * 3600 * 1000))`

**Generation (`generateNPCColonies` rework):**
- 2–5 NPCs per system (seeded random), placed on unique slots, avoiding slot 4 system 1 (homeworld)
- `tier = clamp(1, floor(1 + (systemDistance / maxSystems) * 9) + rng_offset, 10)`
- Building levels from tier: `metalMine = tier*2`, `crystalMine = floor(tier*1.5)`, `deutSynth = floor(tier*1.2)`, `solarPlant = tier*2+2`, `shipyard = max(0, tier-2)`, `roboticsFactory = max(0, tier-3)`, etc.
- Defences from tier: low tiers get only rocket launchers/light lasers; high tiers get full mix
- Fleet from tier: low tiers have nothing or small cargo; high tiers have battleships/destroyers

**Galaxy view:**
- NPC slot shows: name + strength badge (`Tier 1–3` → Weak, `4–6` → Medium, `7–8` → Strong, `9–10` → Massive)
- Resources, exact fleet, exact defences: hidden (shown after espionage, Phase 2.4)
- Debris fields: shown as indicator on slot, clickable for metal/crystal amounts

---

### Debris Fields (`src/models/GameState.ts`)

```ts
interface DebrisField {
  coordinates: Coordinates;
  metal: number;
  crystal: number;
}
```

Add `debrisFields: DebrisField[]` to `GameState`. One field per coordinate — new debris accumulates into existing entry. Harvesting deferred to Phase 3.1.

---

### Migration: v4 → v5

- Regenerate all NPC colonies with new model (`lastRaidedAt: 0`, `current* = base*` = full strength)
- Add `debrisFields: []` to `GameState`
- `STATE_VERSION` → 5

---

---

## Phase 2.3: Fleet Dispatch + Player Raids on NPCs

### Overview

Player dispatches fleets to NPC planets to raid them. Full OGame travel formula, enforced fleet slots, and offline-safe mission lifecycle. Mission types in this phase: `attack` only (transport/harvest/colonize via fleet deferred to Phase 3.2). Galaxy colonization remains instant for now.

---

### Models (`src/models/Fleet.ts` — new file)

```ts
export type MissionType = 'attack';
export type MissionStatus = 'outbound' | 'at_target' | 'returning' | 'completed';

export interface FleetMission {
  id: string;
  type: MissionType;
  status: MissionStatus;
  sourcePlanetIndex: number;
  targetCoordinates: Coordinates;
  targetType: 'npc_colony';
  ships: Record<string, number>;            // ships committed to mission
  cargo: { metal: number; crystal: number; deuterium: number }; // loot carried home
  fuelCost: number;
  departureTime: number;                    // ms timestamp
  arrivalTime: number;                      // ms timestamp
  returnTime: number;                       // ms timestamp (set after at_target resolves)
  combatResultId?: string;                  // links to CombatLogEntry.id
}

export interface CombatLogEntry {
  id: string;
  timestamp: number;
  targetCoordinates: Coordinates;
  result: CombatResult;                     // full CombatResult from CombatEngine
  read: boolean;
}
```

Add to `GameState`:
- `fleetMissions: FleetMission[]`
- `combatLog: CombatLogEntry[]`

---

### Ship drive metadata (`src/data/ships.ts`)

Add `drive` and optional `driveUpgrade` to each `ShipDef`:

```ts
drive: 'combustion' | 'impulse' | 'hyperdrive';
driveUpgrade?: { drive: 'combustion' | 'impulse' | 'hyperdrive'; atLevel: number };
```

Assignments (OGame-accurate):
| Ship | Drive | Upgrade |
|------|-------|---------|
| Small Cargo | combustion (5000) | impulse at lvl 5 → 10000 |
| Large Cargo | combustion (7500) | — |
| Light Fighter | combustion (12500) | — |
| Heavy Fighter | impulse (10000) | — |
| Cruiser | impulse (15000) | — |
| Battleship | hyperdrive (10000) | — |
| Battlecruiser | hyperdrive (10000) | — |
| Bomber | impulse (4000) | hyperdrive at lvl 8 → 5000 |
| Destroyer | hyperdrive (5000) | — |
| Deathstar | hyperdrive (100) | — |
| Colony Ship | impulse (2500) | — |
| Recycler | combustion (2000) | — |
| Espionage Probe | combustion (100000000) | — |

---

### `src/engine/FleetEngine.ts` — new file

**`calcDistance(a: Coordinates, b: Coordinates): number`**
```
same system:  1000 + 5 * |a.slot - b.slot|
diff system:  2700 + 95 * |a.system - b.system|
```

**`calcFleetSpeed(ships, research): number`**
- For each ship type in fleet, resolve effective drive:
  - If `driveUpgrade` exists and the relevant research level >= `atLevel`, use upgrade drive + speed
  - Else use default drive + speed
- Apply tech bonus: combustion `*(1 + 0.1*lvl)`, impulse `*(1 + 0.2*lvl)`, hyperdrive `*(1 + 0.3*lvl)`
- Fleet speed = `min(effectiveSpeed)` across all ship types present

**`calcTravelSeconds(distance, fleetSpeed, gameSpeed): number`**
```
10 + (3500 / gameSpeed) * sqrt(distance * 10 / fleetSpeed)
```

**`calcFuelCost(ships, distance): number`**
```
sum over ship types: baseFuelConsumption * count * (1 + distance / 35000)
```

**`calcMaxFleetSlots(research): number`**
```
1 + research.computerTechnology
```

**`calcCargoCapacity(ships): number`**
```
sum over ship types: shipDef.cargoCapacity * count
```

**`calcLoot(npcResources, survivingShips): { metal, crystal, deuterium }`**
- `available = { metal: npcResources.metal * 0.5, crystal: npcResources.crystal * 0.5, deuterium: npcResources.deuterium * 0.5 }`
- `capacity = calcCargoCapacity(survivingShips)`
- If total available ≤ capacity: take all
- Else: fill metal first (up to available.metal), then crystal, then deuterium, until capacity reached

**`dispatch(state, sourcePlanetIndex, targetCoords, ships): FleetMission | null`**
- Validate: slots available, ships exist on planet, enough deuterium for fuel
- Deduct ships from planet, deduct fuel from planet deuterium
- Compute arrivalTime, set returnTime = 0 (filled after combat)
- Push new mission (status: `'outbound'`) to `state.fleetMissions`
- Return mission or null on failure

**`recallMission(state, missionId): void`**
- Only valid for `outbound` missions
- Compute elapsed time outbound, set new arrivalTime (= now + elapsed) as the return ETA
- Flip status to `returning`, cargo stays empty

**`processTick(state, now): void`** — called each game tick from useGameEngine
Transitions (each mission checked once per tick, idempotent via status guard):

1. `outbound` → `at_target` when `now >= arrivalTime`:
   - Immediately resolve: generate seed (`now ^ missionId hashcode`), call `CombatEngine.simulate()`
   - Apply combat result to NPC colony (`currentDefences`, `currentShips`, `lastRaidedAt`)
   - Calculate loot via `calcLoot`, store in `mission.cargo`
   - Write debris via `addDebris()`
   - Store `CombatLogEntry` in `state.combatLog`, set `mission.combatResultId`
   - Set `mission.returnTime = now + travelSeconds * 1000`
   - Flip status to `returning`

2. `returning` → `completed` when `now >= returnTime`:
   - Deposit `mission.cargo` into source planet resources (capped by storage)
   - Return surviving ships to source planet
   - Flip status to `completed`

3. Prune `completed` missions older than 7 days from `state.fleetMissions`

**Game speed rescaling** — when `setGameSpeed` is called, rescale active mission ETAs:
```
For each mission with status outbound or returning:
  remaining = currentETA - now
  newETA = now + remaining * (oldSpeed / newSpeed)
```
Same pattern as build queue rescaling in `BuildQueue.ts`.

---

### Offline catch-up (`src/engine/StateManager.ts`)

Extend `processOfflineTime` to handle fleet events chronologically:
- Collect mission events: `{ time: arrivalTime, type: 'mission_arrive', mission }` for all `outbound` missions
- Collect return events: `{ time: returnTime, type: 'mission_return', mission }` for all `returning` missions
- Merge into the existing event list (building/research completions), sort by time
- At each mission arrive event: run combat, apply NPC state, set cargo, write debris, flip to `returning`, set `returnTime`
- At each mission return event: deposit cargo + ships, flip to `completed`
- Resource accumulation segments account for all planets as already implemented

---

### GameContext additions (`src/context/GameContext.tsx`)

```ts
fleetTarget: Coordinates | null;
setFleetTarget: (coords: Coordinates | null) => void;
dispatch: (sourcePlanetIndex, targetCoords, ships) => FleetMission | null;
recall: (missionId: string) => void;
```

---

### GalaxyPanel changes (`src/panels/GalaxyPanel.tsx`)

- Clicking an NPC slot calls `setFleetTarget(coords)` and navigates to Fleet panel
- NPC slot shows "recently raided" indicator if `lastRaidedAt > 0 && Date.now() - lastRaidedAt < 48 * 3600 * 1000`
  - Visual: dimmed strength badge + small clock icon or "Rebuilding" label
  - No resource/fleet/defence details shown (espionage gate, Phase 2.4)

---

### FleetPanel redesign (`src/panels/FleetPanel.tsx`)

**Section 1 — Dispatch form** (shown when `fleetTarget !== null`):
- Target coordinates display + clear button
- Ship type rows: only ship types with count > 0, quantity input + "Max" button
- Mission type: "Attack" (only option for NPC in Phase 2.3)
- Live preview (recalculates on every input change):
  - Fleet speed, travel time, arrival ETA, return ETA
  - Fuel cost (warns if insufficient deuterium)
- Fleet slots: "Missions: X / Y" — dispatch button disabled when full or no ships or insufficient fuel

**Section 2 — Active missions** (always shown):
- List of all non-completed missions
- Per mission: type badge, target coords, status, countdown to next transition, recall button (outbound only)

---

### Migration: v5 → v6

Add to `GameState`:
- `fleetMissions: FleetMission[]` (default: `[]`)
- `combatLog: CombatLogEntry[]` (default: `[]`)

`STATE_VERSION` → 6

---

## Phase 2.4: Espionage System

### Overview

Player sends espionage probes to NPC planets via the fleet dispatch system. Probes travel near-instantly, generate a tiered spy report, and may be detected and destroyed. Reports are stored in state and surfaced in two places: a hover panel in the galaxy view, and (in Phase 3.3) the Messages panel.

---

### Mission type extension (`src/models/Fleet.ts`)

Add `'espionage'` to `MissionType`. Espionage missions have a simplified lifecycle:
- `outbound` → `at_target`: resolve report + detection
- If not detected: `returning` → `completed` (probes come home)
- If detected: `completed` immediately (probes destroyed, no return leg)

---

### `EspionageReport` model (`src/models/Fleet.ts`)

```ts
interface EspionageReport {
  id: string;
  timestamp: number;
  targetCoordinates: Coordinates;
  probesSent: number;
  probesLost: number;        // 0 if not detected; all probes if detected
  detected: boolean;
  // Intel tiers — each present only if espionageTech met at scan time
  resources?: { metal: number; crystal: number; deuterium: number }; // always if not detected
  fleet?: Record<string, number>;        // espionageTech >= 2
  defences?: Record<string, number>;     // espionageTech >= 4
  buildings?: Record<string, number>;    // espionageTech >= 6
  tier?: number;                         // espionageTech >= 6 (NPC tier/strength)
  rebuildStatus?: {                      // espionageTech >= 8
    defencePct: number;                  // 0–100
    fleetPct: number;                    // 0–100
  };
  read: boolean;
}
```

Add `espionageReports: EspionageReport[]` to `GameState`.

---

### Dispatch UI (`src/panels/FleetPanel.tsx`)

Add `'Espionage'` as a selectable mission type when probes are present in the fleet selection. Probe count input only (no other ships needed, though mixing is allowed). No cargo section for espionage missions.

---

### `src/engine/EspionageEngine.ts` — new file

**`calcNPCEspionageLevel(tier: number): number`**
```
floor(tier / 2)   // tier 1–2 → 0, tier 3–4 → 1, ..., tier 9–10 → 4
```

**`calcDetectionChance(npcEspionageLevel, playerEspionageTech, probeCount): number`**

OGame formula:
```
if npcEspionageLevel === 0: return 0
ratio = npcEspionageLevel / (playerEspionageTech * probeCount)
return clamp(0, ratio * ratio, 1)
```

**`generateReport(colony, now, probesSent, research, seed): EspionageReport`**

1. Compute NPC espionage level from tier
2. Roll detection using seeded RNG: `rng() < detectionChance`
3. If detected: return report with `detected: true`, `probesLost: probesSent`, no intel fields
4. If not detected:
   - `resources` = `getNPCResources(colony, now)` — always included
   - `fleet` = `getNPCCurrentForce(colony, now).ships` — if `espionageTech >= 2`
   - `defences` = `getNPCCurrentForce(colony, now).defences` — if `espionageTech >= 4`
   - `buildings` = `colony.buildings` — if `espionageTech >= 6`
   - `tier` = `colony.tier` — if `espionageTech >= 6`
   - `rebuildStatus` = computed from `lastRaidedAt` vs base values — if `espionageTech >= 8`
   - `probesLost: 0`

---

### `FleetEngine.processTick` additions

Espionage `at_target` handling:
1. Generate seed (`now ^ missionId hash`)
2. Call `EspionageEngine.generateReport(colony, now, probeCount, research, seed)`
3. Push report to `state.espionageReports`
4. Set `mission.espionageReportId = report.id`
5. If `report.detected`: deduct probes from mission ships, flip to `completed` immediately
6. Else: flip to `returning`, set `returnTime = now + travelSeconds * 1000`

Add `espionageReportId?: string` to `FleetMission`.

---

### Galaxy hover panel (`src/panels/GalaxyPanel.tsx`)

On NPC slot hover, show a floating panel with the most recent `EspionageReport` for those coordinates:
- If no report: "No intelligence — send probes to gather data"
- If detected report only: "Probes were detected — last attempt failed"
- If valid report: show all available intel tiers with labels, timestamp ("Scanned X minutes ago")
- Panel is read-only; does not mark report as read (that's the Messages panel's job)

---

### Fleet dispatch — combat strength estimate

In the dispatch form, when mission type is `'attack'` and a valid (non-detected) espionage report exists for the target with `defences` data:

Calculate strength ratio:
```
attackerPower = sum over selected ships: ship.attack * count * (1 + 0.1 * weaponsTechnology)
defenderPower = sum over NPC fleet + defences: unit.hull * count * (1 + 0.1 * armourTechnology)
ratio = attackerPower / defenderPower
```

Display label:
- `ratio < 0.5` → **Outmatched** (red) — "Your fleet is likely to be destroyed"
- `0.5 ≤ ratio < 1.5` → **Risky odds** (amber) — "Outcome is uncertain"
- `ratio ≥ 1.5` → **Clear advantage** (green) — "Victory is likely"

This estimate is heuristic (doesn't simulate rapid fire or shields) — label it "Combat estimate" to set expectations.

---

### Migration: v6 → v7

Add to `GameState`:
- `espionageReports: EspionageReport[]` (default: `[]`)

`STATE_VERSION` → 7

---

## Phase 2.5: Admin Dashboard

### Overview

A dev-tools panel accessible via a nav sidebar entry (separated from gameplay nav with a divider). Dark monospace styling, clearly labeled as a dev tool. Enables direct state manipulation for testing and content validation. Also introduces **God Mode** — a toggle that surfaces extra manipulation buttons throughout the rest of the game UI.

**Game speed is moved entirely to the Admin panel** — removed from Settings panel. Full slider range (1–100) preserved.

---

### Nav changes

Add `'admin'` to `NavId` type in `src/models/types.ts`. Add an `⚙ Admin` entry at the bottom of `NavSidebar`, visually separated by a horizontal rule.

---

### State changes (`src/models/GameState.ts`)

Add `godMode: boolean` to `GameSettings` (default `false`).

---

### `src/panels/AdminPanel.tsx`

Dark-themed panel, monospace font, `.admin-*` CSS classes. Eight tabs:

**Tab 1 — Resources**
- Planet selector dropdown
- Metal / crystal / deuterium rows: current value, number input, "Set", "Add", "Fill to Cap" buttons
- All mutations save immediately

**Tab 2 — Player Editor**
- Planet selector dropdown
- Building levels: one number input per BuildingId, "Apply All" button (sets levels without queue — direct mutation)
- Ship counts: one number input per ShipId, "Apply All" button
- Defence counts: one number input per DefenceId, "Apply All" button
- Research section (global, not per-planet): one input per ResearchId, "Apply All" button
- "Max Research" button — sets all research to level 10

**Tab 3 — Planets**
- Force colonize: coordinate inputs + "Colonize" button (no colony ship required)
- Convert NPC → player: coordinate inputs + "Convert" button
- Remove NPC: NPC dropdown + "Remove" button
- Add NPC: coordinate inputs + tier slider (1–10) + "Add NPC" button

**Tab 4 — NPC Editor**
- NPC selector dropdown
- Tier slider + "Regenerate from Tier" button (rebuilds base and current)
- Building level inputs + "Apply" button
- Current fleet inputs + "Apply" (current only, does NOT overwrite base) + "Apply to Both" button
- Current defence inputs + "Apply" (current only) + "Apply to Both" button
- "Reset to Full Strength" (current = base, lastRaidedAt = 0)
- "Wipe Fleet & Defences" (zeros current only, base unchanged)

**Tab 5 — Combat**
- NPC selector dropdown
- Ship quantity inputs for active planet fleet (pre-filled with current counts, combat ships checked by default)
- Guard: disable "Resolve" if no ships selected
- "Resolve Combat Now": runs `CombatEngine.simulate()`, applies full result — NPC state, debris, combat log, AND attacker losses/loot to source planet
- Inline result summary after resolution

**Tab 6 — Time Controls**
- Simulate offline time: buttons "+1 min", "+1 hr", "+8 hr", "+24 hr" — calls `processOfflineTime`-equivalent for each duration, advancing resources, queues, and missions
- Custom duration input (minutes) + "Simulate" button
- "Resolve All Missions" — instantly completes every active mission in sequence (arrival then return for each)
- "Complete All Queues" — instantly finishes all building/research/shipyard queues on all planets

**Tab 7 — Debug / State**
- "Clear Combat Log" button
- "Clear Espionage Reports" button
- "Clear Debris Fields" button
- "Reset Unread Badges" button (marks all combat log + espionage reports as read)
- Galaxy seed display + "Regenerate Galaxy" button (new seed → regenerates all NPC colonies, clears missions/logs)
- Collapsible raw JSON state viewer (read-only `<pre>` block)

**Tab 8 — God Mode & Speed**
- God Mode toggle with description of what it enables in other panels
- Game Speed slider: full range 1–100, label showing current value, live update

---

### God Mode — UI effects in other panels

When `state.settings.godMode === true`:

**BuildingsPanel:** "⚡ Complete" button on the **first** queue item only
**ResearchPanel:** "⚡ Complete" button on the **first** queue item only
**ShipyardPanel:** "⚡ Complete" button on the **first** queue item only
**FleetPanel:** "⚡ Resolve" button on each non-completed mission; "⚡ Resolve All" header button
**GalaxyPanel:** On empty slots — "⚡ Colonize" button; on NPC slots — "⚡ Raid Now" (instant combat with active fleet) and "⚡ Remove" button

---

### Bug fixes from review

These correctness issues must be fixed as part of this phase:

1. **`adminResolveMission`**: drive mission to full completion — for outbound missions run both the arrival transition (combat/espionage) AND the return transition (deposit) in a single call, without affecting other missions
2. **`adminTriggerCombat`**: apply full attacker-side result — deduct player ship losses from source planet, deposit loot to source planet; guard against empty fleet
3. **God Mode queue buttons**: only render on the front queue item (index 0), not all items
4. **NPC fleet/defence admin**: "Apply" updates `current` only; add separate "Apply to Both" for base+current
5. **Game speed slider range**: match Settings panel range (1–100); remove speed control from SettingsPanel entirely

---

### GameContext additions (`src/context/GameContext.tsx`)

```ts
setGodMode: (enabled: boolean) => void;
adminSetResources: (planetIndex: number, metal: number, crystal: number, deuterium: number) => void;
adminAddResources: (planetIndex: number, metal: number, crystal: number, deuterium: number) => void;
adminSetBuildings: (planetIndex: number, buildings: Partial<Record<BuildingId, number>>) => void;
adminSetShips: (planetIndex: number, ships: Partial<Record<ShipId, number>>) => void;
adminSetDefences: (planetIndex: number, defences: Partial<Record<DefenceId, number>>) => void;
adminSetResearch: (research: Partial<Record<ResearchId, number>>) => void;
adminForceColonize: (coords: Coordinates) => PlanetState | null;
adminConvertNPC: (coords: Coordinates) => PlanetState | null;
adminRemoveNPC: (coords: Coordinates) => void;
adminAddNPC: (coords: Coordinates, tier: number) => NPCColony | null;
adminSetNPCTier: (coords: Coordinates, tier: number) => void;
adminSetNPCBuildings: (coords: Coordinates, buildings: Partial<Record<BuildingId, number>>) => void;
adminSetNPCCurrentFleet: (coords: Coordinates, ships: Partial<Record<ShipId, number>>, applyToBase?: boolean) => void;
adminSetNPCCurrentDefences: (coords: Coordinates, defences: Partial<Record<DefenceId, number>>, applyToBase?: boolean) => void;
adminResetNPC: (coords: Coordinates) => void;
adminWipeNPC: (coords: Coordinates) => void;
adminCompleteBuilding: (planetIndex: number) => void;   // front item only
adminCompleteResearch: () => void;                       // front item only
adminCompleteShipyard: (planetIndex: number) => void;   // front item only
adminResolveMission: (missionId: string) => void;        // full arrival+return in one call
adminResolveAllMissions: () => void;
adminCompleteAllQueues: () => void;
adminTriggerCombat: (npcCoords: Coordinates, ships: Record<string, number>) => CombatResult | null;
adminSimulateTime: (seconds: number) => void;
adminRegenerateGalaxy: () => void;
adminClearCombatLog: () => void;
adminClearEspionageReports: () => void;
adminClearDebrisFields: () => void;
adminMarkAllRead: () => void;
```

---

### Settings panel changes (`src/panels/SettingsPanel.tsx`)

Remove the game speed slider entirely. All other settings remain.

---

### Migration: v7 → v8

Add to `GameSettings`:
- `godMode: false`

`STATE_VERSION` → 8

---

## Phase 3: Polish & Extended Mechanics

### 3.1 Debris Fields + Recycler Missions

**Debris generation:** After any combat (NPC raid or player attack), destroyed ships generate debris at the target coordinates. Debris = 30% of metal + 30% of crystal cost of destroyed ships. Defences do not generate debris.

**Debris field model:**
```ts
interface DebrisField {
  coordinates: Coordinates;
  metal: number;
  crystal: number;
  createdAt: number;
}
```

Add `debrisFields: DebrisField[]` to `GameState`.

**Harvest mission:** Recyclers sent to a debris field coordinate. Collect resources up to total cargo capacity. Debris field removed when empty.

**NPC raids also generate debris** from destroyed player ships (not defences), giving players a reason to send recyclers after being raided.

### 3.2 Economy Polish

**Colony cap via Astrophysics:** New research `astrophysicsTechnology` in `src/data/research.ts`. Max colonies = `1 + floor(astrophysicsLevel / 2)`. Enforce in `GalaxyEngine.canColonize()`. Prerequisite: `espionageTechnology: 4, impulseDrive: 3`.

**Slot-based planet properties:** Planet slot determines temperature range and field count:
- Slots 1-3: temp 200-400°C, fields 40-70 (hot, small, high deut penalty)
- Slots 4-6: temp 100-200°C, fields 90-130
- Slots 7-9: temp 0-100°C, fields 140-180 (sweet spot)
- Slots 10-12: temp -50-0°C, fields 120-160
- Slots 13-15: temp -100 to -50°C, fields 80-120 (cold, good deut bonus)

Apply during colonization. Homeworld (slot 8) keeps current balanced values.

**Inter-planet transport:** Fleet mission type `'transport'`. Load cargo at source planet, deliver to target player planet. Ships return empty. Uses standard travel time.

**Solar Satellites:** New ship type in `src/data/ships.ts`. Built in shipyard. Each produces `floor(maxTemp + 160) / 6` energy. Destroyed in combat (unlike buildings). Provides an alternative to Solar Plant for energy-hungry colonies.

### 3.3 Messages Panel + Combat Reports

**New panel:** `src/panels/MessagesPanel.tsx` with nav entry.

**Tabs:**
- **Combat** — combat log entries from NPC raids and player attacks, with round-by-round detail view
- **Espionage** — spy reports with resource/fleet/defence info
- **Fleet** — fleet arrival/return notifications

**Features:**
- Unread count badge on nav item
- Mark as read / mark all as read
- Auto-prune messages older than 7 days (in-game time)

### 3.4 UI Polish

**Planet rename:** Click planet name in PlanetSwitcher to edit. Store custom name in `PlanetState.name`.

**Intergalactic Research Network:** If `intergalacticResearchNetwork` tech is added: research speed uses sum of top N research lab levels across planets, where N = IRN level + 1. For simplicity, could skip this or add as a late-game research.

**Fleet slot display:** Show "Missions: X / Y" in Fleet panel header, where Y = 1 + computerTechnology level. Disable dispatch when full.

**Galaxy panel improvements:**
- Show NPC colony strength indicator (weak/medium/strong icons)
- Show debris field indicator on slots that have debris
- Show player planet indicator on occupied slots
- Espionage shortcut: button to send probes directly from galaxy view

---

## Key Architecture Notes

- **Coordinate system:** `{ galaxy: number, system: number, slot: number }` — 1 galaxy, ~50 systems, 15 slots
- **NPC colonies:** Procedurally generated from seed, strength scales with distance from homeworld
- **Combat engine:** Pure function, OGame-style rounds (max 6), rapid-fire system, 70% defence rebuild chance
- **Rapid-fire data:** Lives in `src/data/combat.ts` alongside unit combat stats
- **Fleet missions:** Track lifecycle: outbound → at_target → returning → completed. Enforced by fleet slot cap.
- **Offline processing:** Must handle raids + fleet arrivals + multi-planet production chronologically during catch-up
- **Multi-planet ticks:** All planets accumulate resources each tick, not just the active one
- **Loot model:** NPC colonies have derivable resource pools. Attacker steals up to 50%, capped by cargo capacity.
- **Debris model:** 30% metal+crystal of destroyed ships. Harvested by recyclers.
- **Migration chain:** v1→v2 (defences) → v3 (array queues) → v4 (multi-planet/galaxy) → v5 (combat/raids) → v6 (fleet missions) → v7 (espionage, if separate)
