import { dispatch, resolveMissionArrival, resolveMissionReturn } from '../FleetEngine';
import { createNewGameState } from '../../models/GameState';
import type { NPCColony } from '../../models/Galaxy';

function makeNPCAt(coords: { galaxy: number; system: number; slot: number }): NPCColony {
  return {
    coordinates: coords,
    name: 'NPC',
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
    resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
  };
}

function makeColoniseState() {
  const state = createNewGameState();
  state.research.astrophysicsTechnology = 2;
  state.research.combustionDrive = 6;
  state.planets[0].ships.colonyShip = 2;
  state.planets[0].ships.smallCargo = 2;
  state.planets[0].resources.deuterium = 50000;
  state.planets[0].coordinates = { galaxy: 1, system: 1, slot: 4 };
  return state;
}

describe('Colonise fleet mission', () => {
  it('dispatch fails if no colony ship in fleet', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };

    const result = dispatch(state, 0, target, { smallCargo: 2 }, 'colonise');

    expect(result).toBeNull();
  });

  it('dispatch fails if not exactly 1 colony ship', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };

    const result = dispatch(state, 0, target, { colonyShip: 2 }, 'colonise');

    expect(result).toBeNull();
  });

  it('dispatch fails if max colonies already reached (astrophysics 0)', () => {
    const state = makeColoniseState();
    state.research.astrophysicsTechnology = 0;
    const target = { galaxy: 1, system: 2, slot: 5 };

    const result = dispatch(state, 0, target, { colonyShip: 1 }, 'colonise');

    expect(result).toBeNull();
  });

  it('dispatch fails if target slot is already occupied by NPC', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    state.galaxy.npcColonies.push(makeNPCAt(target));

    const result = dispatch(state, 0, target, { colonyShip: 1 }, 'colonise');

    expect(result).toBeNull();
  });

  it('dispatch removes colony ship and other ships from source planet', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };

    dispatch(state, 0, target, { colonyShip: 1, smallCargo: 2 }, 'colonise');

    expect(state.planets[0].ships.colonyShip).toBe(1);
    expect(state.planets[0].ships.smallCargo).toBe(0);
  });

  it('on arrival at empty slot: creates colony, consumes exactly 1 colony ship', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    const now = Date.now();
    const mission = dispatch(state, 0, target, { colonyShip: 1, smallCargo: 2 }, 'colonise');
    expect(mission).not.toBeNull();
    expect(state.planets.length).toBe(1);

    resolveMissionArrival(state, mission!, now);

    expect(state.planets.length).toBe(2);
    expect(mission!.status).toBe('returning');
    expect(mission!.ships.colonyShip ?? 0).toBe(0);
    expect(mission!.ships.smallCargo).toBe(2);
  });

  it('on arrival when slot already taken: all ships return including colony ship', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    const now = Date.now();
    const mission = dispatch(state, 0, target, { colonyShip: 1 }, 'colonise');
    state.galaxy.npcColonies.push(makeNPCAt(target));

    resolveMissionArrival(state, mission!, now);

    expect(state.planets.length).toBe(1);
    expect(mission!.status).toBe('returning');
    expect(mission!.ships.colonyShip).toBe(1);
  });

  it('returning mission restores escort ships to source planet', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    const now = Date.now();
    const mission = dispatch(state, 0, target, { colonyShip: 1, smallCargo: 2 }, 'colonise');

    resolveMissionArrival(state, mission!, now);
    resolveMissionReturn(state, mission!);

    expect(state.planets[0].ships.smallCargo).toBe(2);
  });

  it('sets firstColony milestone on success', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    const now = Date.now();
    const mission = dispatch(state, 0, target, { colonyShip: 1 }, 'colonise');

    resolveMissionArrival(state, mission!, now);

    expect(state.statistics?.milestones.firstColony).toBeDefined();
  });
});
