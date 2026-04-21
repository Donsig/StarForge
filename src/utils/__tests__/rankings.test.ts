/// <reference types="vitest/globals" />

// Tests for the rankings computation utility.
//
// Encodes the unified OGame cost-points scoring contract from
// docs/superpowers/plans/2026-04-21-scoring-rewrite.md.
//
// New RankingEntry shape:
//   { name, buildings, research, fleet, defence, total, isPlayer }
//
// All rows (player + NPC) are scored in the same units: cost-points via
// scorePointsForCost({metal, crystal, deuterium}) = floor((m+c+d)/1000).
//
// Buildings and research use cumulative costs over all levels. Ships and
// defences use per-unit cost * count.
//
// NPC research is a tier-proportional proxy since NPCs don't maintain an
// explicit research state:
//   research = tier * NPC_RESEARCH_POINTS_PER_TIER
//
// NPC_RESEARCH_POINTS_PER_TIER constant chosen: 2000.
// Rationale: a player maxing all 15 research techs at level 10 accumulates
// roughly ~15,000–25,000 cost-points of research (rough order-of-magnitude,
// dominated by expensive techs like plasmaTechnology with base cost 7000
// per component and a 2x multiplier). A tier-10 NPC should land in the same
// ballpark, so 2000 * 10 = 20,000 is in-band.

import { createNewGameState } from '../../models/GameState.ts';
import type { GameState } from '../../models/GameState.ts';
import type { NPCColony } from '../../models/Galaxy.ts';
import { BUILDINGS } from '../../data/buildings.ts';
import { RESEARCH } from '../../data/research.ts';
import { SHIPS } from '../../data/ships.ts';
import { DEFENCES } from '../../data/defences.ts';

// Import from the yet-to-exist rankings utility.
import { computeRankings } from '../rankings.ts';
// Import the shared cost-points helper module that the implementer will
// create. The failing import IS part of the contract this test encodes.
import {
  cumulativeBuildingCost,
  cumulativeResearchCost,
  scorePointsForCost,
} from '../score.ts';

const NPC_RESEARCH_POINTS_PER_TIER = 2000;

function makeMinimalNPC(overrides: Partial<NPCColony> = {}): NPCColony {
  return {
    coordinates: { galaxy: 1, system: 2, slot: 3 },
    name: 'NPC Colony',
    temperature: 20,
    tier: 1,
    specialty: 'balanced',
    maxTier: 5,
    initialUpgradeIntervalMs: 21_600_000,
    currentUpgradeIntervalMs: 21_600_000,
    targetTier: 1,
    catchUpUpgradeIntervalMs: 5_400_000,
    catchUpProgressTicks: 0,
    lastUpgradeAt: 0,
    upgradeTickCount: 0,
    raidCount: 0,
    recentRaidTimestamps: [],
    buildings: {},
    baseDefences: {},
    baseShips: {},
    currentDefences: {},
    currentShips: {},
    lastRaidedAt: 0,
    resources: { metal: 0, crystal: 0, deuterium: 0 },
    ...overrides,
  };
}

function freshState(): GameState {
  const state = createNewGameState();
  state.galaxy.npcColonies = [];
  return state;
}

// ────────────────────────────────────────────────────────────────────────────
// Group 1 — shape and determinism (MUST-PRESERVE)
// ────────────────────────────────────────────────────────────────────────────

describe('computeRankings — shape and determinism', () => {
  it('returns an array with exactly 1 + npcColonies.length entries', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'A', coordinates: { galaxy: 1, system: 2, slot: 1 } }),
      makeMinimalNPC({ name: 'B', coordinates: { galaxy: 1, system: 2, slot: 2 } }),
      makeMinimalNPC({ name: 'C', coordinates: { galaxy: 1, system: 2, slot: 3 } }),
    ];

    const rankings = computeRankings(state);

    expect(rankings).toHaveLength(4);
  });

  it('has exactly one isPlayer: true entry', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'A', coordinates: { galaxy: 1, system: 2, slot: 1 } }),
      makeMinimalNPC({ name: 'B', coordinates: { galaxy: 1, system: 2, slot: 2 } }),
    ];

    const rankings = computeRankings(state);

    expect(rankings.filter((r) => r.isPlayer)).toHaveLength(1);
  });

  it('uses active planet name for the player when non-empty', () => {
    const state = freshState();
    state.planets[0].name = 'Homeworld';
    state.activePlanetIndex = 0;

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;

    expect(playerEntry.name).toBe('Homeworld');
  });

  it("uses 'You' when active planet name is empty", () => {
    const state = freshState();
    state.planets[0].name = '';

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;

    expect(playerEntry.name).toBe('You');
  });

  it('each NPC entry has name === colony.name', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'Alpha', coordinates: { galaxy: 1, system: 2, slot: 1 } }),
      makeMinimalNPC({ name: 'Beta', coordinates: { galaxy: 1, system: 2, slot: 2 } }),
    ];

    const rankings = computeRankings(state);
    const names = rankings.map((r) => r.name);

    expect(names).toContain('Alpha');
    expect(names).toContain('Beta');
  });

  it('sorts by total descending for non-trivial inputs', () => {
    const state = freshState();
    state.planets[0].buildings.metalMine = 20;
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'Tiny', tier: 1, coordinates: { galaxy: 1, system: 2, slot: 1 } }),
      makeMinimalNPC({
        name: 'Huge',
        tier: 10,
        coordinates: { galaxy: 1, system: 2, slot: 2 },
        buildings: { metalMine: 30, crystalMine: 30 },
      }),
    ];

    const rankings = computeRankings(state);

    for (let i = 0; i < rankings.length - 1; i++) {
      expect(rankings[i].total).toBeGreaterThanOrEqual(rankings[i + 1].total);
    }
  });

  it('is deterministic: same input returns deeply equal output', () => {
    const state = freshState();
    state.planets[0].buildings.metalMine = 10;
    state.research.energyTechnology = 3;
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'A',
        tier: 2,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        buildings: { metalMine: 5 },
      }),
      makeMinimalNPC({
        name: 'B',
        tier: 4,
        coordinates: { galaxy: 1, system: 2, slot: 2 },
        currentShips: { lightFighter: 10 },
      }),
    ];

    const first = computeRankings(state);
    const second = computeRankings(state);

    expect(first).toEqual(second);
  });

  it('total equals buildings + research + fleet + defence for every entry', () => {
    const state = freshState();
    state.planets[0].buildings.metalMine = 15;
    state.planets[0].ships.lightFighter = 5;
    state.planets[0].defences.rocketLauncher = 3;
    state.research.energyTechnology = 4;
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'NPC',
        tier: 3,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        buildings: { metalMine: 10 },
        currentShips: { lightFighter: 7 },
        currentDefences: { rocketLauncher: 2 },
      }),
    ];

    const rankings = computeRankings(state);

    for (const entry of rankings) {
      expect(entry.total).toBe(
        entry.buildings + entry.research + entry.fleet + entry.defence,
      );
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Group 2 — player scoring formulas
// ────────────────────────────────────────────────────────────────────────────

describe('computeRankings — player scoring formulas', () => {
  it('fresh GameState has all four player scores equal to zero', () => {
    const state = freshState();

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;

    expect(playerEntry.buildings).toBe(0);
    expect(playerEntry.research).toBe(0);
    expect(playerEntry.fleet).toBe(0);
    expect(playerEntry.defence).toBe(0);
  });

  it('player buildings score equals cumulative cost-points for metalMine level 5', () => {
    const state = freshState();
    state.planets[0].buildings.metalMine = 5;

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;
    const expected = scorePointsForCost(cumulativeBuildingCost(BUILDINGS.metalMine, 5));

    expect(playerEntry.buildings).toBe(expected);
  });

  it('player buildings score sums cumulative cost-points across multiple buildings', () => {
    const state = freshState();
    state.planets[0].buildings.metalMine = 20;
    state.planets[0].buildings.crystalMine = 15;

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;
    const expected =
      scorePointsForCost(cumulativeBuildingCost(BUILDINGS.metalMine, 20)) +
      scorePointsForCost(cumulativeBuildingCost(BUILDINGS.crystalMine, 15));

    expect(playerEntry.buildings).toBe(expected);
  });

  it('player research score equals cumulative cost-points for energyTechnology level 3', () => {
    const state = freshState();
    state.research.energyTechnology = 3;

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;
    const expected = scorePointsForCost(cumulativeResearchCost(RESEARCH.energyTechnology, 3));

    expect(playerEntry.research).toBe(expected);
  });

  it('player fleet score equals count * cost-points-per-unit for lightFighter', () => {
    const state = freshState();
    state.planets[0].ships.lightFighter = 10;

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;
    const perUnit = scorePointsForCost(SHIPS.lightFighter.cost);

    expect(playerEntry.fleet).toBe(10 * perUnit);
  });

  it('player defence score equals count * cost-points-per-unit for rocketLauncher', () => {
    const state = freshState();
    state.planets[0].defences.rocketLauncher = 5;

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;
    const perUnit = scorePointsForCost(DEFENCES.rocketLauncher.cost);

    expect(playerEntry.defence).toBe(5 * perUnit);
  });

  it('fleet score INCLUDES non-combat ships (recycler)', () => {
    const state = freshState();
    state.planets[0].ships.recycler = 1;

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;

    expect(playerEntry.fleet).toBeGreaterThan(0);
    expect(playerEntry.fleet).toBe(scorePointsForCost(SHIPS.recycler.cost));
  });

  it('player buildings score sums across multiple planets', () => {
    const state = freshState();
    // Give primary planet some buildings
    state.planets[0].buildings.metalMine = 10;
    // Add a second planet with different buildings
    state.planets.push({
      ...state.planets[0],
      name: 'Colony',
      coordinates: { galaxy: 1, system: 1, slot: 5 },
      buildings: {
        ...state.planets[0].buildings,
        metalMine: 0,
        crystalMine: 8,
      },
      ships: { ...state.planets[0].ships, lightFighter: 0, recycler: 0 },
      defences: { ...state.planets[0].defences, rocketLauncher: 0 },
      buildingQueue: [],
      shipyardQueue: [],
    });

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;
    const expected =
      scorePointsForCost(cumulativeBuildingCost(BUILDINGS.metalMine, 10)) +
      scorePointsForCost(cumulativeBuildingCost(BUILDINGS.crystalMine, 8));

    expect(playerEntry.buildings).toBe(expected);
  });

  it('player fleet sums across multiple planets', () => {
    const state = freshState();
    state.planets[0].ships.lightFighter = 5;
    state.planets.push({
      ...state.planets[0],
      name: 'Colony',
      coordinates: { galaxy: 1, system: 1, slot: 5 },
      buildings: { ...state.planets[0].buildings, metalMine: 0 },
      ships: { ...state.planets[0].ships, lightFighter: 7, recycler: 0 },
      defences: { ...state.planets[0].defences, rocketLauncher: 0 },
      buildingQueue: [],
      shipyardQueue: [],
    });

    const playerEntry = computeRankings(state).find((r) => r.isPlayer)!;
    const perUnit = scorePointsForCost(SHIPS.lightFighter.cost);

    expect(playerEntry.fleet).toBe((5 + 7) * perUnit);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Group 3 — NPC scoring formulas
// ────────────────────────────────────────────────────────────────────────────

describe('computeRankings — NPC scoring formulas', () => {
  it('NPC with empty buildings/ships/defences has zero buildings, fleet, defence', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Empty',
        tier: 4,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
      }),
    ];

    const npc = computeRankings(state).find((r) => r.name === 'Empty')!;

    expect(npc.buildings).toBe(0);
    expect(npc.fleet).toBe(0);
    expect(npc.defence).toBe(0);
  });

  it('NPC research equals tier * NPC_RESEARCH_POINTS_PER_TIER', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'T3',
        tier: 3,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
      }),
      makeMinimalNPC({
        name: 'T7',
        tier: 7,
        coordinates: { galaxy: 1, system: 2, slot: 2 },
      }),
    ];

    const rankings = computeRankings(state);
    const t3 = rankings.find((r) => r.name === 'T3')!;
    const t7 = rankings.find((r) => r.name === 'T7')!;

    expect(t3.research).toBe(3 * NPC_RESEARCH_POINTS_PER_TIER);
    expect(t7.research).toBe(7 * NPC_RESEARCH_POINTS_PER_TIER);
  });

  it('NPC buildings score uses cumulative cost formula', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Builder',
        tier: 3,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        buildings: { metalMine: 10, crystalMine: 8 },
      }),
    ];

    const npc = computeRankings(state).find((r) => r.name === 'Builder')!;
    const expected =
      scorePointsForCost(cumulativeBuildingCost(BUILDINGS.metalMine, 10)) +
      scorePointsForCost(cumulativeBuildingCost(BUILDINGS.crystalMine, 8));

    expect(npc.buildings).toBe(expected);
  });

  it('NPC fleet equals count * cost-points-per-unit for lightFighter', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Fleeter',
        tier: 1,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        currentShips: { lightFighter: 20 },
      }),
    ];

    const npc = computeRankings(state).find((r) => r.name === 'Fleeter')!;
    const perUnit = scorePointsForCost(SHIPS.lightFighter.cost);

    expect(npc.fleet).toBe(20 * perUnit);
  });

  it('NPC defence equals count * cost-points-per-unit for rocketLauncher', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Turtle',
        tier: 1,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        currentDefences: { rocketLauncher: 15 },
      }),
    ];

    const npc = computeRankings(state).find((r) => r.name === 'Turtle')!;
    const perUnit = scorePointsForCost(DEFENCES.rocketLauncher.cost);

    expect(npc.defence).toBe(15 * perUnit);
  });

  it('NPC fleet never includes defences; defence never includes ships', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Mixed',
        tier: 1,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        currentShips: { lightFighter: 20 },
        currentDefences: { rocketLauncher: 15 },
      }),
    ];

    const npc = computeRankings(state).find((r) => r.name === 'Mixed')!;
    const shipPerUnit = scorePointsForCost(SHIPS.lightFighter.cost);
    const defencePerUnit = scorePointsForCost(DEFENCES.rocketLauncher.cost);

    // Fleet is ships only — no rocket contribution.
    expect(npc.fleet).toBe(20 * shipPerUnit);
    // Defence is defences only — no lightFighter contribution.
    expect(npc.defence).toBe(15 * defencePerUnit);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Group 4 — calibration (the inverse of the bug we're fixing)
// ────────────────────────────────────────────────────────────────────────────

describe('computeRankings — calibration', () => {
  it('player with real buildings outranks a tier-1 NPC with empty state on buildings column', () => {
    const state = freshState();
    state.planets[0].buildings.metalMine = 10;
    state.planets[0].buildings.crystalMine = 10;
    state.planets[0].buildings.solarPlant = 5;
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'EmptyT1',
        tier: 1,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
      }),
    ];

    const rankings = computeRankings(state);
    const player = rankings.find((r) => r.isPlayer)!;
    const npc = rankings.find((r) => r.name === 'EmptyT1')!;

    expect(player.buildings).toBeGreaterThan(npc.buildings);
  });

  it('player with all 12 buildings at level 1 outranks tier-5 NPC with empty buildings', () => {
    const state = freshState();
    const buildings = state.planets[0].buildings;
    for (const id of Object.keys(buildings) as Array<keyof typeof buildings>) {
      buildings[id] = 1;
    }
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'EmptyT5',
        tier: 5,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
      }),
    ];

    const rankings = computeRankings(state);
    const player = rankings.find((r) => r.isPlayer)!;
    const npc = rankings.find((r) => r.name === 'EmptyT5')!;

    expect(player.buildings).toBeGreaterThan(npc.buildings);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Group 5 — anti-regression
// ────────────────────────────────────────────────────────────────────────────

describe('computeRankings — anti-regression', () => {
  it('NPC with only defences has fleet === 0', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Turtle',
        tier: 2,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        currentShips: {},
        currentDefences: { rocketLauncher: 10 },
      }),
    ];

    const npc = computeRankings(state).find((r) => r.name === 'Turtle')!;

    expect(npc.fleet).toBe(0);
  });

  it('NPC with only ships has defence === 0', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Fleeter',
        tier: 2,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        currentShips: { lightFighter: 10 },
        currentDefences: {},
      }),
    ];

    const npc = computeRankings(state).find((r) => r.name === 'Fleeter')!;

    expect(npc.defence).toBe(0);
  });

  it('NPC ships do not double-count into defence column', () => {
    const state = freshState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'ShipsOnly',
        tier: 1,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        currentShips: { lightFighter: 10 },
        currentDefences: {},
      }),
    ];

    const npc = computeRankings(state).find((r) => r.name === 'ShipsOnly')!;
    const shipPoints = 10 * scorePointsForCost(SHIPS.lightFighter.cost);

    expect(npc.fleet).toBe(shipPoints);
    expect(npc.defence).toBe(0);
    // Total includes ships via fleet but NOT via defence.
    expect(npc.total).toBe(npc.buildings + npc.research + shipPoints + 0);
  });

  it('computeRankings is pure — does not mutate input state', () => {
    const state = freshState();
    state.planets[0].buildings.metalMine = 10;
    state.planets[0].ships.lightFighter = 5;
    state.planets[0].defences.rocketLauncher = 3;
    state.research.energyTechnology = 4;
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'NPC',
        tier: 3,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        buildings: { metalMine: 10 },
        currentShips: { lightFighter: 7 },
        currentDefences: { rocketLauncher: 2 },
      }),
    ];

    const before = JSON.parse(JSON.stringify(state));
    computeRankings(state);
    const after = JSON.parse(JSON.stringify(state));

    expect(after).toEqual(before);
  });
});
