/// <reference types="vitest/globals" />

// Tests for the rankings computation utility.
// These tests drive the creation of src/utils/rankings.ts.
//
// Expected API:
//   export interface RankingEntry {
//     name: string;
//     economy: number;
//     research: number;
//     military: number;
//     fleet: number;
//     total: number;
//     isPlayer: boolean;
//   }
//   export function computeRankings(gameState: GameState): RankingEntry[]
//
// All tests FAIL until src/utils/rankings.ts is created.

import { createNewGameState } from '../../models/GameState.ts';
import type { NPCColony } from '../../models/Galaxy.ts';

// Import from the yet-to-exist rankings utility.
// The import itself will cause the test to fail until the file is created.
import { computeRankings } from '../rankings.ts';

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

describe('computeRankings', () => {
  it('returns an array with exactly 1 entry when no NPCs exist', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [];

    const rankings = computeRankings(state);

    expect(rankings).toHaveLength(1);
    expect(rankings[0].isPlayer).toBe(true);
  });

  it('includes the player and all NPC colonies', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'NPC1', coordinates: { galaxy: 1, system: 2, slot: 1 } }),
      makeMinimalNPC({ name: 'NPC2', coordinates: { galaxy: 1, system: 2, slot: 2 } }),
      makeMinimalNPC({ name: 'NPC3', coordinates: { galaxy: 1, system: 2, slot: 3 } }),
    ];

    const rankings = computeRankings(state);

    expect(rankings).toHaveLength(4); // 1 player + 3 NPCs
    expect(rankings.filter((r) => r.isPlayer)).toHaveLength(1);
    expect(rankings.filter((r) => !r.isPlayer)).toHaveLength(3);
  });

  it('sorts by total score descending', () => {
    const state = createNewGameState();
    // Give the player a non-trivial score via economy buildings
    state.planets[0].buildings.metalMine = 10;
    state.planets[0].buildings.crystalMine = 10;
    state.planets[0].buildings.solarPlant = 10;

    // NPC with tier 1 → economy = 500_000, which should rank above the player
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'Big NPC', tier: 5, coordinates: { galaxy: 1, system: 2, slot: 1 } }),
      makeMinimalNPC({ name: 'Tiny NPC', tier: 1, coordinates: { galaxy: 1, system: 2, slot: 2 } }),
    ];

    const rankings = computeRankings(state);

    // Each entry total >= subsequent entry total
    for (let i = 0; i < rankings.length - 1; i++) {
      expect(rankings[i].total).toBeGreaterThanOrEqual(rankings[i + 1].total);
    }
  });

  it('synthesizes NPC economy from tier: tier * 500_000', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'T3', tier: 3, coordinates: { galaxy: 1, system: 2, slot: 1 } }),
    ];

    const rankings = computeRankings(state);
    const npcEntry = rankings.find((r) => r.name === 'T3');

    expect(npcEntry).toBeDefined();
    expect(npcEntry!.economy).toBe(3 * 500_000);
  });

  it('synthesizes NPC research from tier: tier * 180_000', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'T3', tier: 3, coordinates: { galaxy: 1, system: 2, slot: 1 } }),
    ];

    const rankings = computeRankings(state);
    const npcEntry = rankings.find((r) => r.name === 'T3');

    expect(npcEntry).toBeDefined();
    expect(npcEntry!.research).toBe(3 * 180_000);
  });

  it('synthesizes NPC military from ships plus defences weapon power', () => {
    // lightFighter weaponPower = 50, rocketLauncher weaponPower = 80
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Warrior',
        tier: 1,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        currentShips: { lightFighter: 10 },    // 10 * 50 = 500
        currentDefences: { rocketLauncher: 5 }, // 5 * 80 = 400
      }),
    ];

    const rankings = computeRankings(state);
    const npcEntry = rankings.find((r) => r.name === 'Warrior');

    expect(npcEntry).toBeDefined();
    expect(npcEntry!.military).toBe(500 + 400); // 900
  });

  it('synthesizes NPC fleet from ships only (not defences)', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Fleeter',
        tier: 1,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        currentShips: { lightFighter: 10 },    // 10 * 50 = 500
        currentDefences: { rocketLauncher: 5 }, // should NOT count in fleet
      }),
    ];

    const rankings = computeRankings(state);
    const npcEntry = rankings.find((r) => r.name === 'Fleeter');

    expect(npcEntry).toBeDefined();
    expect(npcEntry!.fleet).toBe(500); // ships only
  });

  it('returns deterministic output for the same input', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'A', tier: 2, coordinates: { galaxy: 1, system: 2, slot: 1 } }),
      makeMinimalNPC({ name: 'B', tier: 4, coordinates: { galaxy: 1, system: 2, slot: 2 } }),
    ];

    const first = computeRankings(state);
    const second = computeRankings(state);

    expect(first).toEqual(second);
  });

  it('player name uses the active planet name', () => {
    const state = createNewGameState();
    state.planets[0].name = 'Homeworld';
    state.activePlanetIndex = 0;

    const rankings = computeRankings(state);
    const playerEntry = rankings.find((r) => r.isPlayer);

    expect(playerEntry).toBeDefined();
    expect(playerEntry!.name).toBe('Homeworld');
  });

  it("player name uses 'You' when active planet name is empty", () => {
    const state = createNewGameState();
    state.planets[0].name = '';
    state.activePlanetIndex = 0;

    const rankings = computeRankings(state);
    const playerEntry = rankings.find((r) => r.isPlayer);

    expect(playerEntry).toBeDefined();
    expect(playerEntry!.name).toBe('You');
  });

  it('player total equals economy + research + military + fleet', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [];

    const rankings = computeRankings(state);
    const playerEntry = rankings.find((r) => r.isPlayer)!;

    expect(playerEntry.total).toBe(
      playerEntry.economy + playerEntry.research + playerEntry.military + playerEntry.fleet,
    );
  });

  it('NPC total equals economy + research + military + fleet', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'BigNPC',
        tier: 5,
        coordinates: { galaxy: 1, system: 3, slot: 1 },
        currentShips: { lightFighter: 20 },
        currentDefences: { rocketLauncher: 10 },
      }),
    ];

    const rankings = computeRankings(state);
    const npc = rankings.find((r) => r.name === 'BigNPC')!;

    expect(npc.total).toBe(npc.economy + npc.research + npc.military + npc.fleet);
  });

  it('NPC entries appear in the rankings with their name', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({ name: 'Alpha', coordinates: { galaxy: 1, system: 2, slot: 1 } }),
      makeMinimalNPC({ name: 'Beta', coordinates: { galaxy: 1, system: 2, slot: 2 } }),
    ];

    const rankings = computeRankings(state);
    const names = rankings.map((r) => r.name);

    expect(names).toContain('Alpha');
    expect(names).toContain('Beta');
  });

  it('player uses correct scores from playerScores when available', () => {
    const state = createNewGameState();
    // Give the player economy via buildings
    state.planets[0].buildings.metalMine = 5;
    state.planets[0].buildings.crystalMine = 3;
    state.galaxy.npcColonies = [];

    const rankings = computeRankings(state);
    const playerEntry = rankings.find((r) => r.isPlayer)!;

    // Economy score should reflect the building levels
    expect(playerEntry.economy).toBeGreaterThan(0);
  });

  it('handles an NPC with no ships or defences (military = 0)', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      makeMinimalNPC({
        name: 'Peaceful',
        tier: 2,
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        currentShips: {},
        currentDefences: {},
      }),
    ];

    const rankings = computeRankings(state);
    const npcEntry = rankings.find((r) => r.name === 'Peaceful')!;

    expect(npcEntry.military).toBe(0);
    expect(npcEntry.fleet).toBe(0);
  });
});
