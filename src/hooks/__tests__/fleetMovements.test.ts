import { createDefaultPlanet, type PlanetState } from '../../models/Planet.ts';
import type { FleetMission } from '../../models/Fleet.ts';
import { deriveFleetMovements } from '../useGameEngine.ts';

function makeMission(overrides: Partial<FleetMission> = {}): FleetMission {
  return {
    id: 'mission-1',
    type: 'attack',
    status: 'outbound',
    sourcePlanetIndex: 0,
    targetCoordinates: { galaxy: 1, system: 2, slot: 3 },
    targetType: 'npc_colony',
    ships: { lightFighter: 5 },
    cargo: { metal: 0, crystal: 0, deuterium: 0 },
    fuelCost: 10,
    departureTime: 1000,
    arrivalTime: 5000,
    returnTime: 9000,
    ...overrides,
  };
}

function makePlanet(name = 'Homeworld'): PlanetState {
  const planet = createDefaultPlanet();
  planet.name = name;
  return planet;
}

describe('deriveFleetMovements', () => {
  it('returns empty array when no missions', () => {
    expect(deriveFleetMovements([], [makePlanet()])).toEqual([]);
  });

  it('excludes completed missions', () => {
    const mission = makeMission({ status: 'completed' });
    expect(deriveFleetMovements([mission], [makePlanet()])).toHaveLength(0);
  });

  it('maps outbound mission to PlayerMovementEntry with correct fields', () => {
    const mission = makeMission({ status: 'outbound', arrivalTime: 5000 });
    const planet = makePlanet('Alpha');
    const [entry] = deriveFleetMovements([mission], [planet]);

    expect(entry.kind).toBe('player');
    expect(entry.id).toBe('mission-1');
    expect(entry.missionType).toBe('attack');
    expect(entry.direction).toBe('outgoing');
    expect(entry.sourcePlanetIndex).toBe(0);
    expect(entry.targetCoordinates).toEqual({ galaxy: 1, system: 2, slot: 3 });
    expect(entry.status).toBe('outbound');
    expect(entry.nextTransitionTime).toBe(5000);
    expect(entry.canRecall).toBe(true);
  });

  it('sets canRecall false for returning mission', () => {
    const mission = makeMission({ status: 'returning', returnTime: 9000 });
    const [entry] = deriveFleetMovements([mission], [makePlanet()]);
    expect(entry.canRecall).toBe(false);
    expect(entry.nextTransitionTime).toBe(9000);
  });

  it('sets nextTransitionTime null for at_target mission', () => {
    const mission = makeMission({ status: 'at_target' });
    const [entry] = deriveFleetMovements([mission], [makePlanet()]);
    expect(entry.nextTransitionTime).toBeNull();
  });

  it('sorts by nextTransitionTime ascending, nulls last', () => {
    const m1 = makeMission({ id: 'a', status: 'outbound', arrivalTime: 9000 });
    const m2 = makeMission({ id: 'b', status: 'outbound', arrivalTime: 3000 });
    const m3 = makeMission({ id: 'c', status: 'at_target' });
    const entries = deriveFleetMovements([m1, m2, m3], [makePlanet()]);

    expect(entries[0].id).toBe('b');
    expect(entries[1].id).toBe('a');
    expect(entries[2].id).toBe('c');
  });
});
