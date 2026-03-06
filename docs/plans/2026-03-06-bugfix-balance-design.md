# Bugfix & Balance — Design Document

Date: 2026-03-06
Branch: phase/bugfix-balance

## Overview

Four improvements targeting NPC relevance, UX navigation, and resource information density.

---

## 1. NPC Dynamic Scaling

### Problem

NPC tiers are assigned once at galaxy generation (distance-based, fixed). Once the player grows, low-tier NPCs near the homeworld become trivially easy and irrelevant. The strength labels ("Weak/Medium/Strong/Massive") are absolute and convey nothing about difficulty relative to the player.

### Player Power Score

A new pure function `computePlayerScores(state: GameState): PlayerScores` is added to `src/engine/ScoreEngine.ts`. It is a pure function with no side effects, reusable for the future scoreboard panel.

```ts
interface PlayerScores {
  military: number;   // fleet combat power weighted by ship stats
  economy:  number;   // sum of mine levels across all planets
  research: number;   // sum of all research levels
  total:    number;   // weighted composite
}
```

Formula:
```
military  = Σ planets → Σ ships: count × SHIP_MILITARY_WEIGHT[type]
            × (1 + weaponsTech × 0.1) × (1 + armourTech × 0.05)
economy   = Σ planets → (metalMine + crystalMine + deutSynth + solarPlant + fusionReactor)
research  = Σ all research levels
total     = military × 2 + economy × 5 + research × 3
```

`SHIP_MILITARY_WEIGHT` lives in `src/data/combat.ts` alongside existing rapid-fire data.

`GameState` gains `playerScores: PlayerScores` (state v12 → v13). Updated once per game tick in `GameEngine.tick()`.

### Effective Tier Floor

```
effectiveMinTier = clamp(1, floor(total / TIER_POWER_THRESHOLD), 10)
TIER_POWER_THRESHOLD = 500   // tunable constant in src/data/balance.ts
```

When `effectiveMinTier > npc.tier`, the NPC's `targetTier` is raised. It does not jump instantly.

### Catch-Up Upgrade Mode

`NPCColony` gains two fields:
```ts
targetTier: number;                // player-power-driven target (>= tier, <= maxTier)
catchUpUpgradeIntervalMs: number;  // accelerated interval while catching up
```

`catchUpUpgradeIntervalMs = initialUpgradeIntervalMs / 4` (4× faster than passive cadence).

`NPCUpgradeEngine` checks: if `colony.tier < colony.targetTier`, use `catchUpUpgradeIntervalMs` instead of `currentUpgradeIntervalMs`. Each upgrade tick increments buildings/ships/defences exactly as the existing logic does. When `colony.tier` reaches `colony.targetTier`, revert to normal passive upgrade cadence.

This is intentionally gradual — a player who suddenly doubles their fleet will see nearby NPCs grow stronger over the next in-game hours, not instantly.

### Relative Strength Labels

Labels in `GalaxyPanel` switch from absolute tier thresholds to a ratio of `npcPower / playerScores.military`:

| Ratio          | Label       |
|----------------|-------------|
| < 0.3          | Easy        |
| 0.3 – 0.7      | Fair        |
| 0.7 – 1.3      | Even        |
| 1.3 – 2.5      | Hard        |
| > 2.5          | Dangerous   |

`npcPower` is computed with the same `SHIP_MILITARY_WEIGHT` table applied to `npc.currentShips` and `npc.currentDefences`.

### Dangerous NPCs Are Raidable

No hard block on raiding any NPC. "Dangerous" means the player will likely draw the first raid (6-round limit), but still collects loot up to cargo capacity. Each raid chips away at the NPC's ships and defences; the rebuild mechanic handles regeneration.

NPC resource pools scale with `tier²` so higher-tier targets hold substantially larger stockpiles:
```
npcResourcePool(tier) = BASE_POOL × tier²
BASE_POOL = { metal: 50_000, crystal: 30_000, deuterium: 10_000 }
```

---

## 2. Clickable Coordinates in Messages

### Problem

Spy reports and combat reports show target coordinates as plain text. Players must manually navigate to the galaxy map and find the system.

### Design

`GameContext` gains:
```ts
galaxyJumpTarget: Coordinates | null;
setGalaxyJumpTarget: (coords: Coordinates | null) => void;
```

`MessagesPanel` renders coordinate strings (e.g. `[1:5:3]`) as `<button className="coord-link">` elements. Clicking calls `setGalaxyJumpTarget(coords)` then `setActivePanel('galaxy')`.

`GalaxyPanel` reads `galaxyJumpTarget` on mount and on change. When non-null, it scrolls to the correct system and highlights the slot, then calls `setGalaxyJumpTarget(null)` to clear.

---

## 3. Manual Coordinate Entry in Galaxy Map

### Problem

No way to jump to an arbitrary system without scrolling.

### Design

A compact `Jump to:` input at the top of `GalaxyPanel`, accepting formats:
- `5` — jump to system 5 in galaxy 1
- `1:5` — jump to galaxy 1, system 5

On Enter or a small Go button, the panel scrolls to that system. If the system is out of range (> MAX_SYSTEMS), show a brief inline error that auto-clears after 2 seconds. No slot targeting (slot selection remains manual).

This input is also pre-filled when `galaxyJumpTarget` is set (from feature 2), showing the full `G:S` coordinates.

---

## 4. Resource Hover Tooltips (Metal, Crystal, Deuterium)

### Problem

Only Energy has a hover breakdown. Metal, Crystal, and Deuterium show a production rate with no detail on what is contributing.

### Design

Follow the exact pattern of the Energy hover in `ResourceBar.tsx` (HoverPortal, stay-open timer, same styling).

**Metal hover:**
- Production: `Metal Mine (Lv N) → +X/hr`
- If energy-penalised: show efficiency percentage `(X% efficiency)`
- Storage: `X / Y` with near-cap warning

**Crystal hover:**
- Production: `Crystal Mine (Lv N) → +X/hr`
- Energy efficiency row if penalised
- Storage: `X / Y`

**Deuterium hover:**
- Production: `Deuterium Synth (Lv N) → +X/hr`
- Temperature factor: `Temp modifier: +X%` or `-X%` based on planet temperature
- Energy efficiency row if penalised
- Storage: `X / Y`

All values use `formatRate()` / `formatNumber()` consistent with existing ResourceBar display.

---

## State Migration

`GameState` version: **v12 → v13**

Changes:
- Add `playerScores: PlayerScores` (default: `{ military: 0, economy: 0, research: 0, total: 0 }`)
- Add `targetTier: number` to each `NPCColony` (default: `colony.tier`)
- Add `catchUpUpgradeIntervalMs: number` to each `NPCColony` (default: `colony.initialUpgradeIntervalMs / 4`)

---

## New Files

- `src/engine/ScoreEngine.ts` — `computePlayerScores()` pure function
- `src/data/balance.ts` — tunable constants (`TIER_POWER_THRESHOLD`, `BASE_POOL`, `SHIP_MILITARY_WEIGHT` if not already in combat.ts)

## Modified Files

- `src/models/GameState.ts` — `playerScores`, NPC colony fields
- `src/engine/GameEngine.ts` — call `computePlayerScores` each tick, update `state.playerScores`
- `src/engine/NPCUpgradeEngine.ts` — catch-up upgrade logic, effectiveMinTier check
- `src/engine/StateManager.ts` — v12→v13 migration
- `src/panels/GalaxyPanel.tsx` — relative strength labels, jump target, coordinate input
- `src/panels/MessagesPanel.tsx` — clickable coordinate buttons
- `src/context/GameContext.tsx` — `galaxyJumpTarget` state
- `src/components/ResourceBar.tsx` — metal/crystal/deuterium hover panels
