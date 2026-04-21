# Scoring System Rewrite — 2026-04-21

## Context & motivation

The current ranking system in `src/utils/rankings.ts` combines three incompatible scoring models in the same row, producing nonsense where a fresh tier-1 NPC outscores a player with a full fleet by 30×+. Diagnosed 8 compounding bugs (see `docs/reviews/2026-04-21-scoring-diagnosis.md` — to be created for reference, or this plan header is enough).

Worst offenders:
- Player `economy` = sum of building *levels* (integer 0-200 max); NPC `economy` = `tier × 500_000`. Different units in the same column.
- Building level sums ignore exponential cost curve — level-30 mine counts same as level-1.
- NPC total double-counts ships (`military = shipW + defW; fleet = shipW; total = sum`).
- `playerScores.buildings` and `playerScores.defence` are tracked in OGame cost-points but silently ignored by rankings.
- Tests encode the bugs, so `npm test` is green while the UI is wrong.

Goal: one scoring model, applied identically to player and NPC, in the same units for every column.

## Target model

**OGame-style cost-points, computed fresh from current state for both player and NPC.**

### Shared helper (already exists)

```ts
scorePointsForCost({ metal, crystal, deuterium }): number
  = Math.floor((metal + crystal + deuterium) / 1000)
```

Currently private in `StateManager.ts:310`. Extract to a shared utility (e.g., `src/utils/score.ts` or inline in `rankings.ts` — implementer's choice).

### New `RankingEntry` shape

```ts
export interface RankingEntry {
  name: string;
  buildings: number;   // replaces `economy`
  research: number;
  fleet: number;        // ships only, cost-points
  defence: number;      // new column
  total: number;        // buildings + research + fleet + defence
  isPlayer: boolean;
}
```

Columns now match the README ("buildings, research, fleet, defence") and the `playerScores` accumulator field names.

### Scoring formulas

#### Player

Iterate `state.planets[*]` and `state.research` fresh on every call (no cache).

- **`buildings`** — for each planet, for each building in `BUILDINGS`, sum `scorePointsForCost(cumulativeCost(buildingDef, currentLevel))`.
  - `cumulativeCost(def, L)` = `Σ_{i=1..L} def.baseCost * def.costMultiplier^(i-1)` for each resource component.
  - Helper shape: `function cumulativeBuildingCost(def: BuildingDefinition, level: number): ResourceCost`.
- **`research`** — for each tech in `RESEARCH`, sum `scorePointsForCost(cumulativeCost(researchDef, currentLevel))`. Same cumulative formula.
- **`fleet`** — for each planet, for each ship id, `count × scorePointsForCost(SHIPS[id].cost)`. Include all ships (combat + non-combat — OGame counts cargo too).
- **`defence`** — for each planet, for each defence id, `count × scorePointsForCost(DEFENCES[id].cost)`.

#### NPC

For each `colony` in `state.galaxy.npcColonies`:

- **`buildings`** — iterate `colony.buildings`, same cumulative-cost formula as player.
- **`research`** — `colony.tier * NPC_RESEARCH_POINTS_PER_TIER`. Calibrated to approximate a maxed-player research score at tier 10. Suggested constant: **2000** (test-writer may refine). NPCs don't have explicit research state; this is a tier-proportional proxy that lives in the same units.
- **`fleet`** — iterate `colony.currentShips`, same formula as player.
- **`defence`** — iterate `colony.currentDefences`, same formula as player.

### Explicitly NOT changing

- `state.playerScores` accumulator fields. Leave them maintained as they are (lifetime totals). Rankings no longer reads them — fresh computation is authoritative. If you want to delete the accumulator later, do it in a separate task.
- `ScoreEngine.ts` — the `computePlayerScores` function becomes unused by rankings. Implementer may delete it AND its test file if they're truly unused elsewhere, or leave as-is. Prefer delete if unused (grep call sites).
- Schema version. No migration needed because we compute from existing fields.

## MUST-PRESERVE behaviours (encoded by tests)

1. `computeRankings(state)` returns an array with exactly `1 + npcColonies.length` entries.
2. Exactly one entry has `isPlayer: true`.
3. Player name uses `planets[activePlanetIndex].name` when non-empty, else `"You"`.
4. Each NPC entry's `name` equals its `colony.name`.
5. Output sorted by `total` descending; stable for ties (preserve insertion order — player first, then colonies in original index order).
6. Deterministic: `computeRankings(state)` called twice returns deeply-equal arrays.
7. `total === buildings + research + fleet + defence` for every entry.
8. `fleet` never includes defences; `defence` never includes ships.
9. For an NPC with empty `currentShips: {}` and empty `currentDefences: {}`, `fleet === 0 && defence === 0`.
10. For a player with no buildings/research/ships/defences (fresh state), `buildings === 0 && research === 0 && fleet === 0 && defence === 0`.
11. Pure function — no `Date.now()`, no `Math.random()`, no I/O.

## Calibration sanity check (encoded as a test)

Given:
- Player with every building at level 20 on a single planet + no research + no ships + no defences.
- NPC of tier 5 with empty state.

Player `buildings` score should be GREATER than NPC `buildings` score. If not, either the NPC formula is too generous or the cumulative-cost helper is wrong. (This is the inverse of the bug we're fixing — current code has the player losing this comparison; new code must flip it.)

## File scope

### Round 1 — test-writer (sonnet subagent)

ALLOWED to modify:
- `src/utils/__tests__/rankings.test.ts` — full rewrite
- `src/engine/__tests__/ScoreEngine.test.ts` — delete or rewrite (if computePlayerScores is kept)
- `src/panels/__tests__/StatisticsPanel.test.tsx` — update ONLY assertions that reference the old `economy`/`military` column names; do not rework test intent
- Optionally: add `src/utils/__tests__/cumulativeCost.test.ts` or similar if helper is extracted

MUST NOT modify:
- `src/utils/rankings.ts`
- `src/engine/ScoreEngine.ts`
- `src/engine/StateManager.ts`
- Any production code

Deliverable: a commit with failing tests that encode the new contract. `npx vitest run src/utils/__tests__/rankings.test.ts` must FAIL. `npm test` full suite will have failures — that's expected and correct at this stage.

### Round 2 — orchestrator review

Spot-check the test file for:
- Fixtures match real types (strict TS, no `@ts-expect-error` without reason)
- Test predicates discriminate (not "any row with total > 0" — assert exact values where computable)
- No internal contradictions
- Calibration test (player > tier-5 NPC when player has buildings and NPC is empty) is present and meaningful

### Round 3 — Codex implementer

ALLOWED to modify:
- `src/utils/rankings.ts` — full rewrite
- `src/engine/ScoreEngine.ts` — delete if unused, or slim if a caller exists
- `src/panels/StatisticsPanel.tsx` — update column names (`economy` → `buildings`, remove `military`, add `defence`) ONLY if required by compile/tests. Do not restyle.
- `src/panels/__tests__/StatisticsPanel.test.tsx` — only if compile demands it
- `src/utils/score.ts` (new) — optional, for the shared `cumulativeCost` + `scorePointsForCost` helpers
- Export `scorePointsForCost` from `StateManager.ts` if re-using in place

MUST NOT modify:
- `state.playerScores` field structure or migration logic
- `src/engine/StateManager.ts` scoring-accumulator code (lines 811, 865, 870)
- Any game-data file (`src/data/*`)
- Any unrelated panel or test

### Round 3 verification gates

All four, in order, must pass:

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npx vitest run src/utils/__tests__/rankings.test.ts src/panels/__tests__/StatisticsPanel.test.tsx`
4. `npm test`
5. `npm run build`  ← REMINDER: `tsc -b` strictness differs from `tsc --noEmit`

## Open questions / test-writer discretion

- **NPC research constant**: 2000 is a suggestion. Test-writer may calibrate based on actual player-at-mid-game research cost-points. Document the chosen value in the test file comment.
- **Non-combat ships in fleet score**: include them (cargo, colony ship, recycler, espionage probe, solar satellite). OGame-consistent. Explicit test covers this.
- **If `ScoreEngine.ts` is still used elsewhere**: test-writer should grep for `computePlayerScores` imports before deleting `ScoreEngine.test.ts`. If only rankings.ts imports it, both can go.

## Post-task manual test checklist (for the user)

After the implementer commits and I run the four gates:

- [ ] Open Statistics panel → player row shows reasonable buildings/research/fleet/defence numbers (not 0, not millions, proportional to progress)
- [ ] Player rank is sensible — early game near bottom, late game competitive with top-tier NPCs
- [ ] NPC rows within the same tier now have VARYING buildings scores (no more 5,000,000 / 4,000,000 / 2,500,000 flat tiers)
- [ ] NPC totals no longer visually inflated — compare to fleet column (no double-counting)
- [ ] Column headers read "Buildings / Research / Fleet / Defence" (not "Economy / Research / Military / Fleet")
- [ ] Sort order still matches descending total
- [ ] No runtime errors in console on panel open
- [ ] Build queues → make a building, then re-open Statistics → your buildings score grew
