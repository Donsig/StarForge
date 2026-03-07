import { dispatch, resolveMissionArrival } from '../FleetEngine';
import { createNewGameState } from '../../models/GameState';
import { createDefaultPlanet } from '../../models/Planet';

function makeDeployState() {
  const state = createNewGameState();
  state.research.combustionDrive = 6;

  state.planets[0].coordinates = { galaxy: 1, system: 1, slot: 4 };
  state.planets[0].ships.lightFighter = 10;
  state.planets[0].resources.deuterium = 50000;
  state.planets[0].resources.metal = 10000;

  const colony = createDefaultPlanet();
  colony.coordinates = { galaxy: 1, system: 2, slot: 5 };
  colony.name = 'Colony 2';
  state.planets.push(colony);

  return state;
}

describe('Deploy fleet mission', () => {
  it('dispatch removes ships from source planet', () => {
    const state = makeDeployState();

    dispatch(state, 0, state.planets[1].coordinates, { lightFighter: 5 }, 'deploy');

    expect(state.planets[0].ships.lightFighter).toBe(5);
  });

  it('dispatch fails if target is not a player planet', () => {
    const state = makeDeployState();
    const emptySlot = { galaxy: 1, system: 3, slot: 7 };

    const result = dispatch(state, 0, emptySlot, { lightFighter: 5 }, 'deploy');

    expect(result).toBeNull();
  });

  it('dispatch fails if target is source planet', () => {
    const state = makeDeployState();

    const result = dispatch(state, 0, state.planets[0].coordinates, { lightFighter: 5 }, 'deploy');

    expect(result).toBeNull();
  });

  it('on arrival: ships merge into target planet, mission completes (no return)', () => {
    const state = makeDeployState();
    const now = Date.now();
    const mission = dispatch(state, 0, state.planets[1].coordinates, { lightFighter: 5 }, 'deploy');
    expect(mission).not.toBeNull();

    resolveMissionArrival(state, mission!, now);

    expect(mission!.status).toBe('completed');
    expect(state.planets[1].ships.lightFighter).toBe(5);
  });

  it('on arrival: cargo deposited into target planet resources', () => {
    const state = makeDeployState();
    const now = Date.now();
    state.planets[0].ships.largeCargo = 2;
    const targetMetalBefore = state.planets[1].resources.metal;
    const mission = dispatch(
      state,
      0,
      state.planets[1].coordinates,
      { largeCargo: 2 },
      'deploy',
      { metal: 5000, crystal: 0, deuterium: 0 },
    );
    expect(mission).not.toBeNull();

    resolveMissionArrival(state, mission!, now);

    expect(state.planets[1].resources.metal).toBeGreaterThan(targetMetalBefore);
  });

  it('on arrival when target planet no longer exists: ships lost, mission completes', () => {
    const state = makeDeployState();
    const targetCoords = { ...state.planets[1].coordinates };
    const now = Date.now();
    const mission = dispatch(state, 0, targetCoords, { lightFighter: 5 }, 'deploy');
    state.planets.splice(1, 1);

    resolveMissionArrival(state, mission!, now);

    expect(mission!.status).toBe('completed');
    expect(state.planets[0].ships.lightFighter).toBe(5);
  });
});
