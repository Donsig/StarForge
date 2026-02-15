/// <reference types="vitest/globals" />

import { BUILDINGS } from '../../data/buildings.ts';
import { RESEARCH } from '../../data/research.ts';
import { SHIPS } from '../../data/ships.ts';
import { createNewGameState, type GameState } from '../../models/GameState.ts';
import { type QueueItem, type ResourceCost } from '../../models/types.ts';
import {
  buildingCostAtLevel,
  buildingTime,
  researchCostAtLevel,
  researchTime,
  shipBuildTime,
} from '../FormulasEngine.ts';
import {
  cancelBuildingAtIndex,
  cancelResearchAtIndex,
  canAfford,
  prerequisitesMet,
  processTick,
  rescaleQueueTimes,
  startBuildingUpgrade,
  startResearch,
  startShipBuild,
  usedFields,
} from '../BuildQueue.ts';

function fundState(state: GameState): void {
  state.planet.resources.metal = 10_000_000;
  state.planet.resources.crystal = 10_000_000;
  state.planet.resources.deuterium = 10_000_000;
}

describe('BuildQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starting a building upgrade deducts resources and enqueues with correct completion time', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.roboticsFactory = 2;
    state.planet.buildings.naniteFactory = 1;

    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const startingResources = { ...state.planet.resources };
    const def = BUILDINGS.metalMine;
    const cost = buildingCostAtLevel(def.baseCost, def.costMultiplier, 1);
    const duration = buildingTime(
      cost.metal,
      cost.crystal,
      state.planet.buildings.roboticsFactory,
      state.planet.buildings.naniteFactory,
      state.settings.gameSpeed,
    );

    const started = startBuildingUpgrade(state, 'metalMine');

    expect(started).toBe(true);
    expect(state.planet.resources.metal).toBe(startingResources.metal - cost.metal);
    expect(state.planet.resources.crystal).toBe(startingResources.crystal - cost.crystal);
    expect(state.planet.resources.deuterium).toBe(
      startingResources.deuterium - cost.deuterium,
    );
    expect(state.planet.buildingQueue).toEqual([
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: now,
        completesAt: now + duration * 1000,
      },
    ]);
  });

  it('can append a building while another building is already queued', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: 1,
        completesAt: 2,
      },
    ];

    expect(startBuildingUpgrade(state, 'crystalMine')).toBe(true);
    expect(state.planet.buildingQueue).toHaveLength(2);
    expect(state.planet.buildingQueue[1].id).toBe('crystalMine');
    expect(state.planet.buildingQueue[1].startedAt).toBe(2);
  });

  it('cannot start a building if resources are insufficient', () => {
    const state = createNewGameState();
    state.planet.resources.metal = 0;
    state.planet.resources.crystal = 0;
    state.planet.resources.deuterium = 0;

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(false);
    expect(state.planet.buildingQueue).toEqual([]);
  });

  it('cannot start a building when prerequisites are not met (shipyard needs robotics factory 2)', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.roboticsFactory = 1;

    expect(startBuildingUpgrade(state, 'shipyard')).toBe(false);
  });

  it('cannot start a building when max planet fields are already used', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.maxFields = usedFields(state);

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(false);
  });

  it('cancelling a building refunds full cost', () => {
    const state = createNewGameState();
    fundState(state);
    vi.spyOn(Date, 'now').mockReturnValue(1_500_000);

    const before = { ...state.planet.resources };
    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);

    cancelBuildingAtIndex(state, 0);

    expect(state.planet.resources).toEqual(before);
    expect(state.planet.buildingQueue).toEqual([]);
  });

  it('processTick completes a building when completion time is reached', () => {
    const state = createNewGameState();
    fundState(state);
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);
    const completesAt = state.planet.buildingQueue[0].completesAt;

    processTick(state, completesAt);

    expect(state.planet.buildings.metalMine).toBe(1);
    expect(state.planet.buildingQueue).toEqual([]);
  });

  it('processTick does not complete a building before completion time', () => {
    const state = createNewGameState();
    fundState(state);
    vi.spyOn(Date, 'now').mockReturnValue(2_500_000);

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);
    const completesAt = state.planet.buildingQueue[0].completesAt;

    processTick(state, completesAt - 1);

    expect(state.planet.buildings.metalMine).toBe(0);
    expect(state.planet.buildingQueue).toHaveLength(1);
  });

  it('starting research deducts resources and sets research queue', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.researchLab = 1;

    const now = 3_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const before = { ...state.planet.resources };
    const def = RESEARCH.energyTechnology;
    const cost = researchCostAtLevel(def.baseCost, def.costMultiplier, 1);
    const duration = researchTime(
      cost.metal,
      cost.crystal,
      state.planet.buildings.researchLab,
      state.settings.gameSpeed,
    );

    const started = startResearch(state, 'energyTechnology');

    expect(started).toBe(true);
    expect(state.planet.resources.metal).toBe(before.metal - cost.metal);
    expect(state.planet.resources.crystal).toBe(before.crystal - cost.crystal);
    expect(state.planet.resources.deuterium).toBe(before.deuterium - cost.deuterium);
    expect(state.researchQueue).toEqual([
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 1,
        startedAt: now,
        completesAt: now + duration * 1000,
      },
    ]);
  });

  it('research prerequisite chains work (laser tech requires energy tech 2)', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.researchLab = 1;
    state.research.energyTechnology = 1;

    expect(startResearch(state, 'laserTechnology')).toBe(false);

    state.research.energyTechnology = 2;
    expect(startResearch(state, 'laserTechnology')).toBe(true);
  });

  it('can append research while another research item is already queued', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.researchLab = 1;
    state.researchQueue = [
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 1,
        startedAt: 1,
        completesAt: 2,
      },
    ];

    expect(startResearch(state, 'energyTechnology')).toBe(true);
    expect(state.researchQueue).toHaveLength(2);
    expect(state.researchQueue[1].id).toBe('energyTechnology');
    expect(state.researchQueue[1].targetLevel).toBe(2);
    expect(state.researchQueue[1].startedAt).toBe(2);
  });

  it('cancelling research refunds full cost', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.researchLab = 1;
    vi.spyOn(Date, 'now').mockReturnValue(3_500_000);

    const before = { ...state.planet.resources };
    expect(startResearch(state, 'energyTechnology')).toBe(true);

    cancelResearchAtIndex(state, 0);

    expect(state.planet.resources).toEqual(before);
    expect(state.researchQueue).toEqual([]);
  });

  it('starting ship building deducts batch cost and creates queue entry', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.shipyard = 1;
    state.research.combustionDrive = 1;

    const now = 4_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const before = { ...state.planet.resources };
    const quantity = 3;
    const totalCost = {
      metal: SHIPS.lightFighter.cost.metal * quantity,
      crystal: SHIPS.lightFighter.cost.crystal * quantity,
      deuterium: SHIPS.lightFighter.cost.deuterium * quantity,
    };
    const perUnitSeconds = shipBuildTime(
      SHIPS.lightFighter.structuralIntegrity,
      state.planet.buildings.shipyard,
      state.planet.buildings.naniteFactory,
      state.settings.gameSpeed,
    );

    const started = startShipBuild(state, 'lightFighter', quantity);

    expect(started).toBe(true);
    expect(state.planet.resources.metal).toBe(before.metal - totalCost.metal);
    expect(state.planet.resources.crystal).toBe(before.crystal - totalCost.crystal);
    expect(state.planet.resources.deuterium).toBe(before.deuterium - totalCost.deuterium);
    expect(state.planet.shipyardQueue).toHaveLength(1);
    expect(state.planet.shipyardQueue[0]).toEqual({
      type: 'ship',
      id: 'lightFighter',
      quantity,
      completed: 0,
      startedAt: now,
      completesAt: now + perUnitSeconds * 1000,
    });
  });

  it('ship queue processes one unit at a time', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    vi.spyOn(Date, 'now').mockReturnValue(4_500_000);

    expect(startShipBuild(state, 'lightFighter', 3)).toBe(true);
    const firstCompletion = state.planet.shipyardQueue[0].completesAt;
    const perUnitSeconds = shipBuildTime(
      SHIPS.lightFighter.structuralIntegrity,
      state.planet.buildings.shipyard,
      state.planet.buildings.naniteFactory,
      state.settings.gameSpeed,
    );

    processTick(state, firstCompletion);
    expect(state.planet.ships.lightFighter).toBe(1);
    expect(state.planet.shipyardQueue).toHaveLength(1);
    expect(state.planet.shipyardQueue[0].completed).toBe(1);
    expect(state.planet.shipyardQueue[0].completesAt).toBe(
      firstCompletion + perUnitSeconds * 1000,
    );

    processTick(state, firstCompletion + perUnitSeconds * 1000);
    expect(state.planet.ships.lightFighter).toBe(2);
    expect(state.planet.shipyardQueue[0].completed).toBe(2);
  });

  it('ship completion increments ship count', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    vi.spyOn(Date, 'now').mockReturnValue(5_000_000);

    expect(startShipBuild(state, 'lightFighter', 1)).toBe(true);
    const completion = state.planet.shipyardQueue[0].completesAt;
    processTick(state, completion);

    expect(state.planet.ships.lightFighter).toBe(1);
    expect(state.planet.shipyardQueue).toHaveLength(0);
  });

  it('ship batch completion removes finished item and next batch can start processing', () => {
    const state = createNewGameState();
    fundState(state);
    state.planet.buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    vi.spyOn(Date, 'now').mockReturnValue(5_500_000);

    expect(startShipBuild(state, 'lightFighter', 1)).toBe(true);
    expect(startShipBuild(state, 'lightFighter', 1)).toBe(true);
    expect(state.planet.shipyardQueue).toHaveLength(2);

    const firstCompletion = state.planet.shipyardQueue[0].completesAt;
    processTick(state, firstCompletion);
    expect(state.planet.ships.lightFighter).toBe(1);
    expect(state.planet.shipyardQueue).toHaveLength(1);

    processTick(state, firstCompletion);
    expect(state.planet.ships.lightFighter).toBe(2);
    expect(state.planet.shipyardQueue).toHaveLength(0);
  });

  it('prerequisitesMet checks both building and research prerequisites', () => {
    const state = createNewGameState();
    state.planet.buildings.roboticsFactory = 2;
    state.research.energyTechnology = 3;

    const requires = [
      { type: 'building' as const, id: 'roboticsFactory', level: 2 },
      { type: 'research' as const, id: 'energyTechnology', level: 3 },
    ];

    expect(prerequisitesMet(requires, state)).toBe(true);

    state.research.energyTechnology = 2;
    expect(prerequisitesMet(requires, state)).toBe(false);
  });

  it('canAfford works at the exact-resource boundary', () => {
    const state = createNewGameState();
    const cost: ResourceCost = { metal: 100, crystal: 50, deuterium: 25 };

    state.planet.resources.metal = 100;
    state.planet.resources.crystal = 50;
    state.planet.resources.deuterium = 25;
    expect(canAfford(cost, state)).toBe(true);

    state.planet.resources.metal = 99;
    expect(canAfford(cost, state)).toBe(false);
  });

  it('usedFields counts total building levels correctly', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 3;
    state.planet.buildings.crystalMine = 2;
    state.planet.buildings.roboticsFactory = 4;

    expect(usedFields(state)).toBe(9);
  });

  it('queues repeated upgrades for the same building with incrementing target levels', () => {
    const state = createNewGameState();
    fundState(state);

    const occupied: QueueItem = {
      type: 'building',
      id: 'solarPlant',
      targetLevel: 1,
      startedAt: 10,
      completesAt: 20,
    };
    state.planet.buildingQueue = [occupied];

    expect(startBuildingUpgrade(state, 'solarPlant')).toBe(true);
    expect(state.planet.buildingQueue).toHaveLength(2);
    expect(state.planet.buildingQueue[1].targetLevel).toBe(2);
  });

  it('rescaleQueueTimes halves remaining building time when speed doubles', () => {
    const state = createNewGameState();
    const now = 10_000;
    state.planet.buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: now - 5000,
        completesAt: now + 20_000, // 20s remaining
      },
    ];

    rescaleQueueTimes(state, 1, 2, now);

    // 20_000 remaining * (1/2) = 10_000
    expect(state.planet.buildingQueue[0].completesAt).toBe(now + 10_000);
  });

  it('rescaleQueueTimes doubles remaining research time when speed halves', () => {
    const state = createNewGameState();
    const now = 50_000;
    state.researchQueue = [
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 1,
        startedAt: now - 10_000,
        completesAt: now + 30_000, // 30s remaining
      },
    ];

    rescaleQueueTimes(state, 2, 1, now);

    // 30_000 remaining * (2/1) = 60_000
    expect(state.researchQueue[0].completesAt).toBe(now + 60_000);
  });

  it('rescaleQueueTimes rescales front shipyard queue item', () => {
    const state = createNewGameState();
    const now = 100_000;
    state.planet.shipyardQueue.push({
      type: 'ship',
      id: 'lightFighter',
      quantity: 5,
      completed: 0,
      startedAt: now - 2000,
      completesAt: now + 8000, // 8s remaining
    });

    rescaleQueueTimes(state, 1, 4, now);

    // 8000 remaining * (1/4) = 2000
    expect(state.planet.shipyardQueue[0].completesAt).toBe(now + 2000);
  });

  it('rescaleQueueTimes is a no-op when old and new speed are equal', () => {
    const state = createNewGameState();
    const now = 10_000;
    state.planet.buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: now - 5000,
        completesAt: now + 20_000,
      },
    ];

    rescaleQueueTimes(state, 3, 3, now);

    expect(state.planet.buildingQueue[0].completesAt).toBe(now + 20_000);
  });

  it('rescaleQueueTimes rescales all queue types simultaneously', () => {
    const state = createNewGameState();
    const now = 100_000;

    state.planet.buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: now - 5000,
        completesAt: now + 10_000,
      },
    ];
    state.researchQueue = [
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 1,
        startedAt: now - 5000,
        completesAt: now + 20_000,
      },
    ];
    state.planet.shipyardQueue.push({
      type: 'ship',
      id: 'lightFighter',
      quantity: 1,
      completed: 0,
      startedAt: now - 1000,
      completesAt: now + 4000,
    });

    // Speed 1 → 2: remaining times halved
    rescaleQueueTimes(state, 1, 2, now);

    expect(state.planet.buildingQueue[0].completesAt).toBe(now + 5000);
    expect(state.researchQueue[0].completesAt).toBe(now + 10_000);
    expect(state.planet.shipyardQueue[0].completesAt).toBe(now + 2000);
  });
});
