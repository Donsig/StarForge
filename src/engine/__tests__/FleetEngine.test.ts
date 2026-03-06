/// <reference types="vitest/globals" />

import { createNewGameState } from '../../models/GameState.ts';
import { createDefaultPlanet } from '../../models/Planet.ts';
import type { FleetMission } from '../../models/Fleet.ts';
import type { Coordinates } from '../../models/Galaxy.ts';
import { getNPCResources } from '../GalaxyEngine.ts';
import {
  calcDistance,
  calcFleetSpeed,
  calcLoot,
  dispatch,
  dispatchHarvest,
  processTick,
  resolveMissionArrival,
  resolveMissionReturn,
  resolveHarvestAtTarget,
  recallMission,
} from '../FleetEngine.ts';

function createTestStateWithTwoPlanets() {
  const state = createNewGameState();
  const colony = createDefaultPlanet();
  colony.name = 'Colony 2';
  colony.coordinates = { galaxy: 1, system: 1, slot: 5 };
  state.planets.push(colony);
  return state;
}

describe('FleetEngine', () => {
  describe('calcDistance', () => {
    it('calculates same-system distance', () => {
      const distance = calcDistance(
        { galaxy: 1, system: 3, slot: 4 },
        { galaxy: 1, system: 3, slot: 10 },
      );
      expect(distance).toBe(1030);
    });

    it('calculates different-system distance', () => {
      const distance = calcDistance(
        { galaxy: 1, system: 2, slot: 4 },
        { galaxy: 1, system: 7, slot: 4 },
      );
      expect(distance).toBe(3175);
    });
  });

  describe('calcFleetSpeed', () => {
    it('applies drive upgrades when required research level is met', () => {
      const state = createNewGameState();
      state.research.combustionDrive = 0;
      state.research.impulseDrive = 4;

      const noUpgradeSpeed = calcFleetSpeed({ smallCargo: 1 }, state.research);
      expect(noUpgradeSpeed).toBe(5000);

      state.research.impulseDrive = 5;
      const upgradedSpeed = calcFleetSpeed({ smallCargo: 1 }, state.research);
      expect(upgradedSpeed).toBe(20000);
    });

    it('returns the minimum effective speed for mixed fleets', () => {
      const state = createNewGameState();
      const speed = calcFleetSpeed(
        { lightFighter: 3, bomber: 1 },
        state.research,
      );

      expect(speed).toBe(4000);
    });
  });

  describe('calcLoot', () => {
    it('takes all available loot when under cargo capacity', () => {
      const loot = calcLoot(
        { metal: 1000, crystal: 1000, deuterium: 1000 },
        { smallCargo: 1 },
      );
      expect(loot).toEqual({ metal: 500, crystal: 500, deuterium: 500 });
    });

    it('fills cargo with metal first when over capacity', () => {
      const loot = calcLoot(
        { metal: 20000, crystal: 10000, deuterium: 10000 },
        { smallCargo: 1 },
      );
      expect(loot).toEqual({ metal: 5000, crystal: 0, deuterium: 0 });
    });

    it('returns zero loot when no resources are available', () => {
      const loot = calcLoot(
        { metal: 0, crystal: 0, deuterium: 0 },
        { smallCargo: 5 },
      );
      expect(loot).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
    });

    it('never steals more than 50% of any single resource even with excess cargo', () => {
      const loot = calcLoot(
        { metal: 1200, crystal: 800, deuterium: 400 },
        { smallCargo: 100 },
      );
      expect(loot).toEqual({ metal: 600, crystal: 400, deuterium: 200 });
    });
  });

  describe('dispatch', () => {
    it('creates a mission and deducts ships + fuel on success', () => {
      const state = createNewGameState();
      const sourcePlanet = state.planets[0];
      sourcePlanet.ships.smallCargo = 3;
      sourcePlanet.resources.deuterium = 1000;

      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const mission = dispatch(
        state,
        0,
        { galaxy: 1, system: 1, slot: 1 },
        { smallCargo: 2 },
      );

      expect(mission).not.toBeNull();
      expect(state.fleetMissions).toHaveLength(1);
      expect(sourcePlanet.ships.smallCargo).toBe(1);
      expect(sourcePlanet.resources.deuterium).toBe(1000 - (mission?.fuelCost ?? 0));
    });

    it('fails when fleet slots are full', () => {
      const state = createNewGameState();
      const sourcePlanet = state.planets[0];
      sourcePlanet.ships.smallCargo = 2;
      sourcePlanet.resources.deuterium = 1000;
      state.research.computerTechnology = 0;

      const existingMission: FleetMission = {
        id: 'mission_existingdeadbeef',
        type: 'attack',
        status: 'outbound',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 1, slot: 6 },
        targetType: 'npc_colony',
        ships: { smallCargo: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: 10_000,
        arrivalTime: 20_000,
        returnTime: 0,
      };
      state.fleetMissions.push(existingMission);

      const mission = dispatch(
        state,
        0,
        { galaxy: 1, system: 1, slot: 1 },
        { smallCargo: 1 },
      );

      expect(mission).toBeNull();
      expect(state.fleetMissions).toHaveLength(1);
      expect(sourcePlanet.ships.smallCargo).toBe(2);
    });

    it('fails when source planet lacks deuterium for fuel', () => {
      const state = createNewGameState();
      const sourcePlanet = state.planets[0];
      sourcePlanet.ships.smallCargo = 1;
      sourcePlanet.resources.deuterium = 0;

      const mission = dispatch(
        state,
        0,
        { galaxy: 1, system: 1, slot: 15 },
        { smallCargo: 1 },
      );

      expect(mission).toBeNull();
      expect(state.fleetMissions).toHaveLength(0);
      expect(sourcePlanet.ships.smallCargo).toBe(1);
    });

    it('allows dispatching more than one espionage probe', () => {
      const state = createNewGameState();
      const sourcePlanet = state.planets[0];
      sourcePlanet.ships.espionageProbe = 5;
      sourcePlanet.resources.deuterium = 100;

      const mission = dispatch(
        state,
        0,
        { galaxy: 1, system: 1, slot: 8 },
        { espionageProbe: 3 },
        'espionage',
      );

      expect(mission).not.toBeNull();
      expect(mission?.ships.espionageProbe).toBe(3);
      expect(sourcePlanet.ships.espionageProbe).toBe(2);
    });

    it('blocks dispatching to an abandoning npc colony', () => {
      const state = createNewGameState();
      const sourcePlanet = state.planets[0];
      sourcePlanet.ships.smallCargo = 2;
      sourcePlanet.resources.deuterium = 1000;
      state.galaxy.npcColonies = [
        {
          coordinates: { galaxy: 1, system: 1, slot: 9 },
          name: 'Abandoning Target',
          temperature: 15,
          tier: 4,
          specialty: 'balanced',
          maxTier: 8,
          initialUpgradeIntervalMs: 10_800_000,
          currentUpgradeIntervalMs: 10_800_000,
          lastUpgradeAt: 0,
          upgradeTickCount: 0,
          raidCount: 0,
          recentRaidTimestamps: [],
          abandonedAt: 1_000,
          buildings: {},
          baseDefences: {},
          baseShips: {},
          currentDefences: {},
          currentShips: {},
          lastRaidedAt: 0,
          resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
        },
      ];

      const mission = dispatch(
        state,
        0,
        { galaxy: 1, system: 1, slot: 9 },
        { smallCargo: 1 },
      );

      expect(mission).toBeNull();
    });
  });

  describe('transport dispatch', () => {
    it('deducts cargo and fuel from source planet on dispatch', () => {
      const state = createTestStateWithTwoPlanets();
      const source = state.planets[0];
      source.resources.metal = 10000;
      source.ships.smallCargo = 5; // cargo cap 5 * 5000 = 25000
      source.resources.deuterium = 1000;

      const mission = dispatch(
        state,
        0,
        state.planets[1].coordinates,
        { smallCargo: 5 },
        'transport',
        { metal: 5000, crystal: 0, deuterium: 0 },
      );
      expect(mission).not.toBeNull();
      expect(source.resources.metal).toBe(5000); // deducted
    });

    it('returns null if cargo exceeds fleet capacity', () => {
      const state = createTestStateWithTwoPlanets();
      state.planets[0].ships.smallCargo = 1; // cap 5000
      state.planets[0].resources.metal = 20000;
      state.planets[0].resources.deuterium = 1000;
      const result = dispatch(
        state,
        0,
        state.planets[1].coordinates,
        { smallCargo: 1 },
        'transport',
        { metal: 10000, crystal: 0, deuterium: 0 },
      );
      expect(result).toBeNull();
    });

    it('returns null if target is not a player planet', () => {
      const state = createNewGameState();
      state.planets[0].ships.smallCargo = 1;
      state.planets[0].resources.metal = 1000;
      state.planets[0].resources.deuterium = 1000;
      const npcCoords = { galaxy: 1, system: 4, slot: 9 };
      state.galaxy.npcColonies = [
        {
          coordinates: npcCoords,
          name: 'NPC',
          temperature: 40,
          tier: 2,
          specialty: 'balanced',
          maxTier: 5,
          initialUpgradeIntervalMs: 21_600_000,
          currentUpgradeIntervalMs: 21_600_000,
          lastUpgradeAt: 0,
          upgradeTickCount: 0,
          raidCount: 0,
          recentRaidTimestamps: [],
          abandonedAt: undefined,
          buildings: {},
          baseDefences: {},
          baseShips: {},
          currentDefences: {},
          currentShips: {},
          lastRaidedAt: 0,
          resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
        },
      ];
      const result = dispatch(
        state,
        0,
        npcCoords,
        { smallCargo: 1 },
        'transport',
        { metal: 100, crystal: 0, deuterium: 0 },
      );
      expect(result).toBeNull();
    });
  });

  describe('transport at_target resolution', () => {
    it('deposits cargo to target planet', () => {
      const state = createTestStateWithTwoPlanets();
      state.planets[0].ships.smallCargo = 1;
      state.planets[0].resources.metal = 10000;
      state.planets[0].resources.deuterium = 1000;
      const mission = dispatch(
        state,
        0,
        state.planets[1].coordinates,
        { smallCargo: 1 },
        'transport',
        { metal: 5000, crystal: 0, deuterium: 0 },
      );
      expect(mission).not.toBeNull();
      if (!mission) return;
      resolveMissionArrival(state, mission, Date.now());
      expect(state.planets[1].resources.metal).toBeGreaterThan(500); // base 500 + 5000
    });

    it('keeps overflow in cargo for return when target storage is full', () => {
      const state = createTestStateWithTwoPlanets();
      state.planets[0].ships.smallCargo = 1;
      state.planets[0].resources.metal = 10000;
      state.planets[0].resources.deuterium = 1000;
      state.planets[1].resources.metal = 999999; // fill to overflow
      const mission = dispatch(
        state,
        0,
        state.planets[1].coordinates,
        { smallCargo: 1 },
        'transport',
        { metal: 5000, crystal: 0, deuterium: 0 },
      );
      expect(mission).not.toBeNull();
      if (!mission) return;
      resolveMissionArrival(state, mission, Date.now());
      expect(mission.cargo.metal).toBeGreaterThan(0); // undelivered stays in cargo
      expect(mission.status).toBe('returning');
    });

    it('returns undelivered cargo to source on return', () => {
      const state = createTestStateWithTwoPlanets();
      state.planets[0].ships.smallCargo = 1;
      state.planets[0].resources.metal = 10000;
      state.planets[0].resources.deuterium = 1000;
      state.planets[1].resources.metal = 999999;
      const mission = dispatch(
        state,
        0,
        state.planets[1].coordinates,
        { smallCargo: 1 },
        'transport',
        { metal: 5000, crystal: 0, deuterium: 0 },
      );
      expect(mission).not.toBeNull();
      if (!mission) return;
      resolveMissionArrival(state, mission, Date.now());
      const metalBeforeReturn = state.planets[0].resources.metal;
      resolveMissionReturn(state, mission);
      expect(state.planets[0].resources.metal).toBeGreaterThan(metalBeforeReturn);
    });
  });

  describe('dispatchHarvest', () => {
    it('fails when no debris field exists at target', () => {
      const state = createNewGameState();
      state.planets[0].ships.recycler = 3;
      state.planets[0].resources.deuterium = 1000;

      const mission = dispatchHarvest(
        state,
        0,
        { galaxy: 1, system: 1, slot: 9 },
      );

      expect(mission).toBeNull();
      expect(state.fleetMissions).toHaveLength(0);
    });

    it('fails when source planet has no recyclers', () => {
      const state = createNewGameState();
      state.planets[0].ships.recycler = 0;
      state.planets[0].resources.deuterium = 1000;
      state.debrisFields = [
        {
          coordinates: { galaxy: 1, system: 1, slot: 9 },
          metal: 15_000,
          crystal: 5_000,
        },
      ];

      const mission = dispatchHarvest(
        state,
        0,
        { galaxy: 1, system: 1, slot: 9 },
      );

      expect(mission).toBeNull();
      expect(state.fleetMissions).toHaveLength(0);
    });

    it('fails when fleet slots are full', () => {
      const state = createNewGameState();
      state.research.computerTechnology = 0;
      state.planets[0].ships.recycler = 5;
      state.planets[0].resources.deuterium = 1000;
      state.debrisFields = [
        {
          coordinates: { galaxy: 1, system: 1, slot: 9 },
          metal: 20_000,
          crystal: 20_000,
        },
      ];
      state.fleetMissions.push({
        id: 'mission_existingharvest',
        type: 'attack',
        status: 'outbound',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 1, slot: 6 },
        targetType: 'npc_colony',
        ships: { smallCargo: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: 10_000,
        arrivalTime: 20_000,
        returnTime: 0,
      });

      const mission = dispatchHarvest(
        state,
        0,
        { galaxy: 1, system: 1, slot: 9 },
      );

      expect(mission).toBeNull();
      expect(state.fleetMissions).toHaveLength(1);
    });
  });

  describe('resolveHarvestAtTarget', () => {
    it('collects all debris when recycler capacity is enough', () => {
      const state = createNewGameState();
      const now = 250_000;
      state.debrisFields = [
        {
          coordinates: { galaxy: 1, system: 2, slot: 8 },
          metal: 12_000,
          crystal: 4_000,
        },
      ];
      const mission: FleetMission = {
        id: 'mission_harvest_full',
        type: 'harvest',
        status: 'at_target',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 2, slot: 8 },
        targetType: 'debris_field',
        ships: { recycler: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: now - 60_000,
        arrivalTime: now,
        returnTime: 0,
      };

      resolveHarvestAtTarget(state, mission, now);

      expect(mission.status).toBe('returning');
      expect(mission.cargo).toEqual({ metal: 12_000, crystal: 4_000, deuterium: 0 });
      expect(mission.returnTime).toBeGreaterThan(now);
      expect(state.debrisFields).toHaveLength(0);
    });

    it('collects partial debris with metal-first priority', () => {
      const state = createNewGameState();
      const now = 250_000;
      state.debrisFields = [
        {
          coordinates: { galaxy: 1, system: 2, slot: 9 },
          metal: 5_000,
          crystal: 25_000,
        },
      ];
      const mission: FleetMission = {
        id: 'mission_harvest_partial',
        type: 'harvest',
        status: 'at_target',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 2, slot: 9 },
        targetType: 'debris_field',
        ships: { recycler: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: now - 60_000,
        arrivalTime: now,
        returnTime: 0,
      };

      resolveHarvestAtTarget(state, mission, now);

      expect(mission.cargo).toEqual({ metal: 5_000, crystal: 15_000, deuterium: 0 });
      expect(state.debrisFields).toEqual([
        {
          coordinates: { galaxy: 1, system: 2, slot: 9 },
          metal: 0,
          crystal: 10_000,
        },
      ]);
    });

    it('removes debris field when fully harvested', () => {
      const state = createNewGameState();
      const now = 250_000;
      state.debrisFields = [
        {
          coordinates: { galaxy: 1, system: 3, slot: 1 },
          metal: 10_000,
          crystal: 10_000,
        },
      ];
      const mission: FleetMission = {
        id: 'mission_harvest_emptyfield',
        type: 'harvest',
        status: 'at_target',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 3, slot: 1 },
        targetType: 'debris_field',
        ships: { recycler: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: now - 60_000,
        arrivalTime: now,
        returnTime: 0,
      };

      resolveHarvestAtTarget(state, mission, now);

      expect(state.debrisFields).toHaveLength(0);
    });

    it('returns empty cargo when debris field is missing', () => {
      const state = createNewGameState();
      const now = 250_000;
      const mission: FleetMission = {
        id: 'mission_harvest_missing',
        type: 'harvest',
        status: 'at_target',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 4, slot: 4 },
        targetType: 'debris_field',
        ships: { recycler: 2 },
        cargo: { metal: 10, crystal: 10, deuterium: 0 },
        fuelCost: 10,
        departureTime: now - 60_000,
        arrivalTime: now,
        returnTime: 0,
      };

      resolveHarvestAtTarget(state, mission, now);

      expect(mission.status).toBe('returning');
      expect(mission.cargo).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
      expect(mission.returnTime).toBeGreaterThan(now);
    });

    it('creates a FleetNotification with collected loot on successful harvest', () => {
      const state = createNewGameState();
      const now = 300_000;
      state.debrisFields = [{ coordinates: { galaxy: 1, system: 2, slot: 8 }, metal: 10_000, crystal: 5_000 }];
      const mission: FleetMission = {
        id: 'harvest_notif_test',
        type: 'harvest',
        status: 'at_target',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 2, slot: 8 },
        targetType: 'debris_field',
        ships: { recycler: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: now - 60_000,
        arrivalTime: now,
        returnTime: 0,
      };

      resolveHarvestAtTarget(state, mission, now);

      expect(state.fleetNotifications).toHaveLength(1);
      expect(state.fleetNotifications[0].id).toBe('harvest_notif_test-notif');
      expect(state.fleetNotifications[0].missionId).toBe('harvest_notif_test');
      expect(state.fleetNotifications[0].missionType).toBe('harvest');
      expect(state.fleetNotifications[0].loot).toEqual({ metal: 10_000, crystal: 5_000, deuterium: 0 });
      expect(state.fleetNotifications[0].read).toBe(false);
    });

    it('creates a FleetNotification with zero loot when debris field is missing', () => {
      const state = createNewGameState();
      const now = 300_000;
      const mission: FleetMission = {
        id: 'harvest_missing_field',
        type: 'harvest',
        status: 'at_target',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 9, slot: 9 },
        targetType: 'debris_field',
        ships: { recycler: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: now - 60_000,
        arrivalTime: now,
        returnTime: 0,
      };

      resolveHarvestAtTarget(state, mission, now);

      expect(state.fleetNotifications).toHaveLength(1);
      expect(state.fleetNotifications[0].loot).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
    });

    it('does not create duplicate notification if called twice for the same mission', () => {
      const state = createNewGameState();
      const now = 300_000;
      state.debrisFields = [{ coordinates: { galaxy: 1, system: 2, slot: 8 }, metal: 1_000, crystal: 500 }];
      const mission: FleetMission = {
        id: 'harvest_idempotent',
        type: 'harvest',
        status: 'at_target',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 2, slot: 8 },
        targetType: 'debris_field',
        ships: { recycler: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: now - 60_000,
        arrivalTime: now,
        returnTime: 0,
      };

      resolveHarvestAtTarget(state, mission, now);
      resolveHarvestAtTarget(state, mission, now);

      expect(state.fleetNotifications).toHaveLength(1);
    });
  });

  describe('transport FleetNotification', () => {
    function makeTransportMission(
      id: string,
      targetCoords: Coordinates,
      cargo: { metal: number; crystal: number; deuterium: number },
    ): FleetMission {
      return {
        id,
        type: 'transport',
        status: 'at_target',
        sourcePlanetIndex: 0,
        targetCoordinates: targetCoords,
        targetType: 'player_planet',
        ships: { smallCargo: 1 },
        cargo,
        fuelCost: 5,
        departureTime: Date.now() - 60_000,
        arrivalTime: Date.now(),
        returnTime: 0,
      };
    }

    it('creates a FleetNotification with delivered amount when target planet exists', () => {
      const state = createNewGameState();
      const now = 400_000;
      const colony = createDefaultPlanet();
      colony.coordinates = { galaxy: 1, system: 1, slot: 5 };
      colony.name = 'Colony Alpha';
      state.planets.push(colony);

      const mission = makeTransportMission(
        'transport_notif_1',
        { galaxy: 1, system: 1, slot: 5 },
        { metal: 10_000, crystal: 5_000, deuterium: 0 },
      );

      state.fleetMissions.push({ ...mission, status: 'outbound', arrivalTime: now - 1 });
      processTick(state, now);

      const notif = state.fleetNotifications.find((entry) => entry.missionType === 'transport');
      expect(notif).toBeDefined();
      expect(notif!.targetName).toBe('Colony Alpha');
      expect(notif!.loot.metal).toBe(10_000);
      expect(notif!.loot.crystal).toBe(5_000);
    });

    it('creates a zero-loot FleetNotification when transport target planet is gone', () => {
      const state = createNewGameState();
      const now = 400_000;

      const mission = makeTransportMission(
        'transport_notif_missing',
        { galaxy: 2, system: 5, slot: 3 },
        { metal: 5_000, crystal: 0, deuterium: 0 },
      );
      state.fleetMissions.push({ ...mission, status: 'outbound', arrivalTime: now - 1 });
      processTick(state, now);

      const notif = state.fleetNotifications.find((entry) => entry.missionId === 'transport_notif_missing');
      expect(notif).toBeDefined();
      expect(notif!.loot).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
    });
  });

  describe('recallMission', () => {
    it('reverses an outbound mission and sets returning ETA from elapsed outbound time', () => {
      const state = createNewGameState();
      state.fleetMissions.push({
        id: 'mission_1234abcd',
        type: 'attack',
        status: 'outbound',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 2, slot: 5 },
        targetType: 'npc_colony',
        ships: { smallCargo: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: 1_000,
        arrivalTime: 9_000,
        returnTime: 0,
      });

      vi.spyOn(Date, 'now').mockReturnValue(4_000);
      const recalled = recallMission(state, 'mission_1234abcd');

      const [mission] = state.fleetMissions;
      expect(recalled).toBe(true);
      expect(mission.status).toBe('returning');
      expect(mission.returnTime).toBe(7_000);
      expect(mission.cargo).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
    });

    it('does not recall missions that have effectively already arrived', () => {
      const state = createNewGameState();
      state.fleetMissions.push({
        id: 'mission_abcd1234',
        type: 'attack',
        status: 'outbound',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 2, slot: 5 },
        targetType: 'npc_colony',
        ships: { smallCargo: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: 1_000,
        arrivalTime: 9_000,
        returnTime: 0,
      });

      vi.spyOn(Date, 'now').mockReturnValue(9_000);
      const recalled = recallMission(state, 'mission_abcd1234');

      expect(recalled).toBe(false);
      expect(state.fleetMissions[0].status).toBe('outbound');
      expect(state.fleetMissions[0].returnTime).toBe(0);
    });
  });

  describe('processTick', () => {
    it('returns mission safely when target npc colony no longer exists', () => {
      const state = createNewGameState();
      const now = 100_000;
      state.fleetMissions.push({
        id: 'mission_missingnpc',
        type: 'attack',
        status: 'outbound',
        sourcePlanetIndex: 0,
        targetCoordinates: { galaxy: 1, system: 9, slot: 12 },
        targetType: 'npc_colony',
        ships: { smallCargo: 2 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 10,
        departureTime: now - 5000,
        arrivalTime: now - 1,
        returnTime: 0,
      });

      processTick(state, now);

      expect(state.fleetMissions[0].status).toBe('returning');
      expect(state.fleetMissions[0].ships.smallCargo).toBe(2);
      expect(state.fleetMissions[0].cargo).toEqual({
        metal: 0,
        crystal: 0,
        deuterium: 0,
      });
      expect(state.fleetMissions[0].returnTime).toBeGreaterThan(now);
    });

    it('sets npc resourcesAtLastRaid to available minus loot after attack', () => {
      const state = createNewGameState();
      const now = 500_000;
      state.settings.gameSpeed = 1;
      state.planets[0].ships.smallCargo = 10;
      state.planets[0].resources.deuterium = 10_000;
      state.galaxy.npcColonies = [
        {
          coordinates: { galaxy: 1, system: 4, slot: 7 },
          name: 'Loot Target',
          temperature: 25,
          tier: 3,
          specialty: 'balanced',
          maxTier: 5,
          initialUpgradeIntervalMs: 21_600_000,
          currentUpgradeIntervalMs: 21_600_000,
          lastUpgradeAt: 0,
          upgradeTickCount: 0,
          raidCount: 0,
          recentRaidTimestamps: [],
          abandonedAt: undefined,
          buildings: {
            metalMine: 8,
            crystalMine: 6,
            deuteriumSynthesizer: 4,
            solarPlant: 10,
          },
          baseDefences: {},
          baseShips: {},
          currentDefences: {},
          currentShips: {},
          lastRaidedAt: now - 3600 * 1000,
          resourcesAtLastRaid: { metal: 1000, crystal: 800, deuterium: 600 },
        },
      ];
      const availableBefore = getNPCResources(
        state.galaxy.npcColonies[0],
        now,
        state.settings.gameSpeed,
      );
      const mission = dispatch(
        state,
        0,
        { galaxy: 1, system: 4, slot: 7 },
        { smallCargo: 2 },
      );
      expect(mission).not.toBeNull();
      if (!mission) {
        return;
      }
      mission.arrivalTime = now;

      processTick(state, now);

      const updatedColony = state.galaxy.npcColonies[0];
      const loot = state.fleetMissions[0].cargo;
      expect(updatedColony.resourcesAtLastRaid).toEqual({
        metal: Math.max(0, Math.floor(availableBefore.metal - loot.metal)),
        crystal: Math.max(0, Math.floor(availableBefore.crystal - loot.crystal)),
        deuterium: Math.max(0, Math.floor(availableBefore.deuterium - loot.deuterium)),
      });
      expect(updatedColony.lastRaidedAt).toBe(now);
    });

    it('prunes old fleet notifications using history retention rules', () => {
      const state = createNewGameState();
      const now = 10_000_000;
      state.fleetNotifications = [
        {
          id: 'old-notif',
          missionId: 'old-mission',
          timestamp: now - (31 * 24 * 3600 * 1000),
          missionType: 'harvest',
          targetCoordinates: { galaxy: 1, system: 1, slot: 1 },
          targetName: 'Old Field',
          loot: { metal: 1, crystal: 1, deuterium: 0 },
          read: true,
        },
        {
          id: 'recent-notif',
          missionId: 'recent-mission',
          timestamp: now - 1_000,
          missionType: 'transport',
          targetCoordinates: { galaxy: 1, system: 1, slot: 2 },
          targetName: 'Recent Colony',
          loot: { metal: 2, crystal: 2, deuterium: 0 },
          read: false,
        },
      ];

      processTick(state, now);

      expect(state.fleetNotifications).toHaveLength(1);
      expect(state.fleetNotifications[0].id).toBe('recent-notif');
    });
  });
});
