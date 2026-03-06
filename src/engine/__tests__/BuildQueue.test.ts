/// <reference types="vitest/globals" />

import { BUILDINGS } from '../../data/buildings.ts';
import { DEFENCES } from '../../data/defences.ts';
import { RESEARCH } from '../../data/research.ts';
import { SHIPS } from '../../data/ships.ts';
import { createNewGameState, type GameState } from '../../models/GameState.ts';
import { createDefaultPlanet } from '../../models/Planet.ts';
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
  cancelShipyardAtIndex,
  canAfford,
  effectiveResearchLabLevel,
  prerequisitesMet,
  processTick,
  rescaleQueueTimes,
  startBuildingUpgrade,
  startDefenceBuild,
  startResearch,
  startShipBuild,
  usedFields,
} from '../BuildQueue.ts';

function fundState(state: GameState): void {
  state.planets[0].resources.metal = 10_000_000;
  state.planets[0].resources.crystal = 10_000_000;
  state.planets[0].resources.deuterium = 10_000_000;
}

describe('effectiveResearchLabLevel', () => {
  it('returns source planet lab level when IRN = 0', () => {
    const state = createNewGameState();
    state.planets[0].buildings.researchLab = 5;
    state.research.intergalacticResearchNetwork = 0;

    const item: QueueItem = {
      type: 'research',
      id: 'energyTechnology',
      targetLevel: 1,
      sourcePlanetIndex: 0,
      startedAt: 0,
      completesAt: 0,
    };

    expect(effectiveResearchLabLevel(state, item)).toBe(5);
  });

  it('returns source planet lab when only 1 planet regardless of IRN', () => {
    const state = createNewGameState();
    state.planets[0].buildings.researchLab = 8;
    state.research.intergalacticResearchNetwork = 3;

    const item: QueueItem = {
      type: 'research',
      id: 'energyTechnology',
      targetLevel: 1,
      sourcePlanetIndex: 0,
      startedAt: 0,
      completesAt: 0,
    };

    expect(effectiveResearchLabLevel(state, item)).toBe(8);
  });

  it('sums top (IRN+1) labs when multiple planets and IRN > 0', () => {
    const state = createNewGameState();
    state.planets[0].buildings.researchLab = 10;
    const colony = createDefaultPlanet();
    colony.buildings.researchLab = 6;
    colony.coordinates = { galaxy: 1, system: 1, slot: 5 };
    state.planets.push(colony);
    const colony2 = createDefaultPlanet();
    colony2.buildings.researchLab = 4;
    colony2.coordinates = { galaxy: 1, system: 1, slot: 6 };
    state.planets.push(colony2);

    state.research.intergalacticResearchNetwork = 1;

    const item: QueueItem = {
      type: 'research',
      id: 'energyTechnology',
      targetLevel: 1,
      sourcePlanetIndex: 0,
      startedAt: 0,
      completesAt: 0,
    };

    expect(effectiveResearchLabLevel(state, item)).toBe(16);
  });

  it('uses source planet lab as fallback when sourcePlanetIndex missing and IRN = 0', () => {
    const state = createNewGameState();
    state.planets[0].buildings.researchLab = 3;
    state.research.intergalacticResearchNetwork = 0;

    const item: QueueItem = {
      type: 'research',
      id: 'energyTechnology',
      targetLevel: 1,
      sourcePlanetIndex: undefined,
      startedAt: 0,
      completesAt: 0,
    };

    expect(effectiveResearchLabLevel(state, item)).toBe(3);
  });
});

describe('BuildQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starting a building upgrade deducts resources and enqueues with correct completion time', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.roboticsFactory = 2;
    state.planets[0].buildings.naniteFactory = 1;

    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const startingResources = { ...state.planets[0].resources };
    const def = BUILDINGS.metalMine;
    const cost = buildingCostAtLevel(def.baseCost, def.costMultiplier, 1);
    const duration = buildingTime(
      cost.metal,
      cost.crystal,
      state.planets[0].buildings.roboticsFactory,
      state.planets[0].buildings.naniteFactory,
      state.settings.gameSpeed,
    );

    const started = startBuildingUpgrade(state, 'metalMine');

    expect(started).toBe(true);
    expect(state.planets[0].resources.metal).toBe(startingResources.metal - cost.metal);
    expect(state.planets[0].resources.crystal).toBe(startingResources.crystal - cost.crystal);
    expect(state.planets[0].resources.deuterium).toBe(
      startingResources.deuterium - cost.deuterium,
    );
    expect(state.planets[0].buildingQueue).toEqual([
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
    state.planets[0].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: 1,
        completesAt: 2,
      },
    ];

    expect(startBuildingUpgrade(state, 'crystalMine')).toBe(true);
    expect(state.planets[0].buildingQueue).toHaveLength(2);
    expect(state.planets[0].buildingQueue[1].id).toBe('crystalMine');
    expect(state.planets[0].buildingQueue[1].startedAt).toBe(2);
  });

  it('cannot start a building if resources are insufficient', () => {
    const state = createNewGameState();
    state.planets[0].resources.metal = 0;
    state.planets[0].resources.crystal = 0;
    state.planets[0].resources.deuterium = 0;

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(false);
    expect(state.planets[0].buildingQueue).toEqual([]);
  });

  it('cannot start a building when prerequisites are not met (shipyard needs robotics factory 2)', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.roboticsFactory = 1;

    expect(startBuildingUpgrade(state, 'shipyard')).toBe(false);
  });

  it('cannot start a building when max planet fields are already used', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].maxFields = usedFields(state);

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(false);
  });

  it('cancelling a building refunds full cost', () => {
    const state = createNewGameState();
    fundState(state);
    vi.spyOn(Date, 'now').mockReturnValue(1_500_000);

    const before = { ...state.planets[0].resources };
    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);

    cancelBuildingAtIndex(state, 0);

    expect(state.planets[0].resources).toEqual(before);
    expect(state.planets[0].buildingQueue).toEqual([]);
  });

  it('processTick completes a building when completion time is reached', () => {
    const state = createNewGameState();
    fundState(state);
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);
    const completesAt = state.planets[0].buildingQueue[0].completesAt;

    processTick(state, completesAt);

    expect(state.planets[0].buildings.metalMine).toBe(1);
    expect(state.planets[0].buildingQueue).toEqual([]);
  });

  it('processTick does not complete a building before completion time', () => {
    const state = createNewGameState();
    fundState(state);
    vi.spyOn(Date, 'now').mockReturnValue(2_500_000);

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);
    const completesAt = state.planets[0].buildingQueue[0].completesAt;

    processTick(state, completesAt - 1);

    expect(state.planets[0].buildings.metalMine).toBe(0);
    expect(state.planets[0].buildingQueue).toHaveLength(1);
  });

  it('processTick advances building and shipyard queues for non-active planets', () => {
    const state = createNewGameState();
    const colony = createDefaultPlanet();
    colony.coordinates = { galaxy: 1, system: 2, slot: 7 };
    state.planets.push(colony);
    state.activePlanetIndex = 0;

    const now = 2_750_000;
    state.planets[1].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: now - 1000,
        completesAt: now,
      },
    ];
    state.planets[1].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 1,
        completed: 0,
        startedAt: now - 1000,
        completesAt: now,
      },
    ];

    processTick(state, now);

    expect(state.planets[1].buildings.metalMine).toBe(1);
    expect(state.planets[1].buildingQueue).toEqual([]);
    expect(state.planets[1].ships.lightFighter).toBe(1);
    expect(state.planets[1].shipyardQueue).toEqual([]);
  });

  it('starting research deducts resources and sets research queue', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.researchLab = 1;

    const now = 3_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const before = { ...state.planets[0].resources };
    const def = RESEARCH.energyTechnology;
    const cost = researchCostAtLevel(def.baseCost, def.costMultiplier, 1);
    const duration = researchTime(
      cost.metal,
      cost.crystal,
      state.planets[0].buildings.researchLab,
      state.settings.gameSpeed,
    );

    const started = startResearch(state, 'energyTechnology');

    expect(started).toBe(true);
    expect(state.planets[0].resources.metal).toBe(before.metal - cost.metal);
    expect(state.planets[0].resources.crystal).toBe(before.crystal - cost.crystal);
    expect(state.planets[0].resources.deuterium).toBe(before.deuterium - cost.deuterium);
    expect(state.researchQueue).toEqual([
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 1,
        sourcePlanetIndex: 0,
        startedAt: now,
        completesAt: now + duration * 1000,
      },
    ]);
  });

  it('research prerequisite chains work (laser tech requires energy tech 2)', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.researchLab = 1;
    state.research.energyTechnology = 1;

    expect(startResearch(state, 'laserTechnology')).toBe(false);

    state.research.energyTechnology = 2;
    expect(startResearch(state, 'laserTechnology')).toBe(true);
  });

  it('can append research while another research item is already queued', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.researchLab = 1;
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
    state.planets[0].buildings.researchLab = 1;
    vi.spyOn(Date, 'now').mockReturnValue(3_500_000);

    const before = { ...state.planets[0].resources };
    expect(startResearch(state, 'energyTechnology')).toBe(true);

    cancelResearchAtIndex(state, 0);

    expect(state.planets[0].resources).toEqual(before);
    expect(state.researchQueue).toEqual([]);
  });

  it('uses the queued research source planet lab level for next research timing', () => {
    const state = createNewGameState();
    const lowLabPlanet = createDefaultPlanet();
    lowLabPlanet.coordinates = { galaxy: 1, system: 2, slot: 8 };
    lowLabPlanet.buildings.researchLab = 1;
    state.planets.push(lowLabPlanet);

    state.planets[0].buildings.researchLab = 10;
    state.activePlanetIndex = 1;
    state.research.energyTechnology = 0;
    state.researchQueue = [
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 1,
        sourcePlanetIndex: 0,
        startedAt: 0,
        completesAt: 1000,
      },
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 2,
        sourcePlanetIndex: 0,
        startedAt: 0,
        completesAt: 0,
      },
    ];

    processTick(state, 1000);

    const costLevel2 = researchCostAtLevel(
      RESEARCH.energyTechnology.baseCost,
      RESEARCH.energyTechnology.costMultiplier,
      2,
    );
    const expectedDurationSeconds = researchTime(
      costLevel2.metal,
      costLevel2.crystal,
      10,
      state.settings.gameSpeed,
    );

    expect(state.research.energyTechnology).toBe(1);
    expect(state.researchQueue[0].sourcePlanetIndex).toBe(0);
    expect(state.researchQueue[0].completesAt).toBe(1000 + expectedDurationSeconds * 1000);
  });

  it('starting ship building deducts batch cost and creates queue entry', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.shipyard = 1;
    state.research.combustionDrive = 1;

    const now = 4_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const before = { ...state.planets[0].resources };
    const quantity = 3;
    const totalCost = {
      metal: SHIPS.lightFighter.cost.metal * quantity,
      crystal: SHIPS.lightFighter.cost.crystal * quantity,
      deuterium: SHIPS.lightFighter.cost.deuterium * quantity,
    };
    const perUnitSeconds = shipBuildTime(
      SHIPS.lightFighter.structuralIntegrity,
      state.planets[0].buildings.shipyard,
      state.planets[0].buildings.naniteFactory,
      state.settings.gameSpeed,
    );

    const started = startShipBuild(state, 'lightFighter', quantity);

    expect(started).toBe(true);
    expect(state.planets[0].resources.metal).toBe(before.metal - totalCost.metal);
    expect(state.planets[0].resources.crystal).toBe(before.crystal - totalCost.crystal);
    expect(state.planets[0].resources.deuterium).toBe(before.deuterium - totalCost.deuterium);
    expect(state.planets[0].shipyardQueue).toHaveLength(1);
    expect(state.planets[0].shipyardQueue[0]).toEqual({
      type: 'ship',
      id: 'lightFighter',
      quantity,
      completed: 0,
      startedAt: now,
      completesAt: now + perUnitSeconds * 1000,
    });
  });

  it('cancelShipyardAtIndex cancels active batch and refunds only remaining units', () => {
    const state = createNewGameState();
    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 5,
        completed: 2,
        startedAt: 1000,
        completesAt: 2000,
      },
    ];

    const before = { ...state.planets[0].resources };
    const remaining = 3;
    const unitCost = SHIPS.lightFighter.cost;

    cancelShipyardAtIndex(state, 0);

    expect(state.planets[0].shipyardQueue).toEqual([]);
    expect(state.planets[0].resources.metal).toBe(before.metal + unitCost.metal * remaining);
    expect(state.planets[0].resources.crystal).toBe(before.crystal + unitCost.crystal * remaining);
    expect(state.planets[0].resources.deuterium).toBe(
      before.deuterium + unitCost.deuterium * remaining,
    );
  });

  it('cancelShipyardAtIndex cancels queued batch and refunds full batch cost', () => {
    const state = createNewGameState();
    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 3,
        completed: 1,
        startedAt: 1000,
        completesAt: 2000,
      },
      {
        type: 'defence',
        id: 'rocketLauncher',
        quantity: 4,
        completed: 0,
        startedAt: 2000,
        completesAt: 3000,
      },
    ];

    const before = { ...state.planets[0].resources };
    const frontItem = { ...state.planets[0].shipyardQueue[0] };
    const unitCost = DEFENCES.rocketLauncher.cost;
    const quantity = 4;

    cancelShipyardAtIndex(state, 1);

    expect(state.planets[0].shipyardQueue).toHaveLength(1);
    expect(state.planets[0].shipyardQueue[0]).toEqual(frontItem);
    expect(state.planets[0].resources.metal).toBe(before.metal + unitCost.metal * quantity);
    expect(state.planets[0].resources.crystal).toBe(before.crystal + unitCost.crystal * quantity);
    expect(state.planets[0].resources.deuterium).toBe(
      before.deuterium + unitCost.deuterium * quantity,
    );
  });

  it('cancelShipyardAtIndex initializes next batch when front item is canceled', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.shipyard = 1;
    const now = 7_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 2,
        completed: 0,
        startedAt: now - 1000,
        completesAt: now + 5000,
      },
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 3,
        completed: 0,
        startedAt: 0,
        completesAt: 0,
      },
    ];

    cancelShipyardAtIndex(state, 0);

    expect(state.planets[0].shipyardQueue).toHaveLength(1);
    const nextItem = state.planets[0].shipyardQueue[0];
    expect(nextItem.quantity).toBe(3);
    expect(nextItem.startedAt).toBe(now);
    expect(nextItem.completesAt).toBeGreaterThan(now);
  });

  it('cancelShipyardAtIndex is a no-op for out-of-range indexes', () => {
    const state = createNewGameState();
    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 2,
        completed: 0,
        startedAt: 1000,
        completesAt: 2000,
      },
    ];

    const beforeResources = { ...state.planets[0].resources };
    const beforeQueue = state.planets[0].shipyardQueue.map((item) => ({ ...item }));

    cancelShipyardAtIndex(state, -1);
    cancelShipyardAtIndex(state, state.planets[0].shipyardQueue.length);

    expect(state.planets[0].resources).toEqual(beforeResources);
    expect(state.planets[0].shipyardQueue).toEqual(beforeQueue);
  });

  it('ship queue processes one unit at a time', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    vi.spyOn(Date, 'now').mockReturnValue(4_500_000);

    expect(startShipBuild(state, 'lightFighter', 3)).toBe(true);
    const firstCompletion = state.planets[0].shipyardQueue[0].completesAt;
    const perUnitSeconds = shipBuildTime(
      SHIPS.lightFighter.structuralIntegrity,
      state.planets[0].buildings.shipyard,
      state.planets[0].buildings.naniteFactory,
      state.settings.gameSpeed,
    );

    processTick(state, firstCompletion);
    expect(state.planets[0].ships.lightFighter).toBe(1);
    expect(state.planets[0].shipyardQueue).toHaveLength(1);
    expect(state.planets[0].shipyardQueue[0].completed).toBe(1);
    expect(state.planets[0].shipyardQueue[0].completesAt).toBe(
      firstCompletion + perUnitSeconds * 1000,
    );

    processTick(state, firstCompletion + perUnitSeconds * 1000);
    expect(state.planets[0].ships.lightFighter).toBe(2);
    expect(state.planets[0].shipyardQueue[0].completed).toBe(2);
  });

  it('prevents queueing shield domes above maxCount when one is already queued', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.shipyard = 1;
    state.research.shieldingTechnology = 2;

    expect(startDefenceBuild(state, 'smallShieldDome', 1)).toBe(true);
    expect(startDefenceBuild(state, 'smallShieldDome', 1)).toBe(false);
  });

  it('ship completion increments ship count', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    vi.spyOn(Date, 'now').mockReturnValue(5_000_000);

    expect(startShipBuild(state, 'lightFighter', 1)).toBe(true);
    const completion = state.planets[0].shipyardQueue[0].completesAt;
    processTick(state, completion);

    expect(state.planets[0].ships.lightFighter).toBe(1);
    expect(state.planets[0].shipyardQueue).toHaveLength(0);
  });

  it('ship batch completion removes finished item and next batch can start processing', () => {
    const state = createNewGameState();
    fundState(state);
    state.planets[0].buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    vi.spyOn(Date, 'now').mockReturnValue(5_500_000);

    expect(startShipBuild(state, 'lightFighter', 1)).toBe(true);
    expect(startShipBuild(state, 'lightFighter', 1)).toBe(true);
    expect(state.planets[0].shipyardQueue).toHaveLength(2);

    const firstCompletion = state.planets[0].shipyardQueue[0].completesAt;
    processTick(state, firstCompletion);
    expect(state.planets[0].ships.lightFighter).toBe(1);
    expect(state.planets[0].shipyardQueue).toHaveLength(1);

    processTick(state, firstCompletion);
    expect(state.planets[0].ships.lightFighter).toBe(2);
    expect(state.planets[0].shipyardQueue).toHaveLength(0);
  });

  it('prerequisitesMet checks both building and research prerequisites', () => {
    const state = createNewGameState();
    state.planets[0].buildings.roboticsFactory = 2;
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

    state.planets[0].resources.metal = 100;
    state.planets[0].resources.crystal = 50;
    state.planets[0].resources.deuterium = 25;
    expect(canAfford(cost, state)).toBe(true);

    state.planets[0].resources.metal = 99;
    expect(canAfford(cost, state)).toBe(false);
  });

  it('usedFields counts total building levels correctly', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 3;
    state.planets[0].buildings.crystalMine = 2;
    state.planets[0].buildings.roboticsFactory = 4;

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
    state.planets[0].buildingQueue = [occupied];

    expect(startBuildingUpgrade(state, 'solarPlant')).toBe(true);
    expect(state.planets[0].buildingQueue).toHaveLength(2);
    expect(state.planets[0].buildingQueue[1].targetLevel).toBe(2);
  });

  it('rescaleQueueTimes halves remaining building time when speed doubles', () => {
    const state = createNewGameState();
    const now = 10_000;
    state.planets[0].buildingQueue = [
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
    expect(state.planets[0].buildingQueue[0].completesAt).toBe(now + 10_000);
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
    state.planets[0].shipyardQueue.push({
      type: 'ship',
      id: 'lightFighter',
      quantity: 5,
      completed: 0,
      startedAt: now - 2000,
      completesAt: now + 8000, // 8s remaining
    });

    rescaleQueueTimes(state, 1, 4, now);

    // 8000 remaining * (1/4) = 2000
    expect(state.planets[0].shipyardQueue[0].completesAt).toBe(now + 2000);
  });

  it('rescaleQueueTimes is a no-op when old and new speed are equal', () => {
    const state = createNewGameState();
    const now = 10_000;
    state.planets[0].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: now - 5000,
        completesAt: now + 20_000,
      },
    ];

    rescaleQueueTimes(state, 3, 3, now);

    expect(state.planets[0].buildingQueue[0].completesAt).toBe(now + 20_000);
  });

  it('rescaleQueueTimes rescales all queue types simultaneously', () => {
    const state = createNewGameState();
    const now = 100_000;

    state.planets[0].buildingQueue = [
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
    state.planets[0].shipyardQueue.push({
      type: 'ship',
      id: 'lightFighter',
      quantity: 1,
      completed: 0,
      startedAt: now - 1000,
      completesAt: now + 4000,
    });

    // Speed 1 → 2: remaining times halved
    rescaleQueueTimes(state, 1, 2, now);

    expect(state.planets[0].buildingQueue[0].completesAt).toBe(now + 5000);
    expect(state.researchQueue[0].completesAt).toBe(now + 10_000);
    expect(state.planets[0].shipyardQueue[0].completesAt).toBe(now + 2000);
  });

  it('rescaleQueueTimes also rescales non-active planets', () => {
    const state = createNewGameState();
    const colony = createDefaultPlanet();
    colony.coordinates = { galaxy: 1, system: 2, slot: 9 };
    state.planets.push(colony);
    state.activePlanetIndex = 0;
    const now = 120_000;

    state.planets[1].buildingQueue = [
      {
        type: 'building',
        id: 'crystalMine',
        targetLevel: 1,
        startedAt: now - 5000,
        completesAt: now + 30_000,
      },
    ];
    state.planets[1].shipyardQueue = [
      {
        type: 'ship',
        id: 'smallCargo',
        quantity: 1,
        completed: 0,
        startedAt: now - 2000,
        completesAt: now + 12_000,
      },
    ];

    rescaleQueueTimes(state, 1, 2, now);

    expect(state.planets[1].buildingQueue[0].completesAt).toBe(now + 15_000);
    expect(state.planets[1].shipyardQueue[0].completesAt).toBe(now + 6000);
  });
});
