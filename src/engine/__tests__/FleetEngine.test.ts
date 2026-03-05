/// <reference types="vitest/globals" />

import { createNewGameState } from '../../models/GameState.ts';
import type { FleetMission } from '../../models/Fleet.ts';
import {
  calcDistance,
  calcFleetSpeed,
  calcLoot,
  dispatch,
  recallMission,
} from '../FleetEngine.ts';

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
      recallMission(state, 'mission_1234abcd');

      const [mission] = state.fleetMissions;
      expect(mission.status).toBe('returning');
      expect(mission.returnTime).toBe(7_000);
      expect(mission.cargo).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
    });
  });
});
