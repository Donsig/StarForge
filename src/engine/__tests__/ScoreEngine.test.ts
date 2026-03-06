import { computePlayerScores } from '../ScoreEngine';
import { createNewGameState } from '../../models/GameState';

describe('computePlayerScores', () => {
  it('returns all zeros for a fresh game', () => {
    const state = createNewGameState();
    const scores = computePlayerScores(state);
    expect(scores.military).toBe(0);
    expect(scores.economy).toBe(0);
    expect(scores.research).toBe(0);
    expect(scores.total).toBe(0);
  });

  it('counts economy from productive buildings across all planets', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 5;
    state.planets[0].buildings.crystalMine = 3;
    state.planets[0].buildings.deuteriumSynthesizer = 2;
    const scores = computePlayerScores(state);
    expect(scores.economy).toBe(10); // 5+3+2+0+0
  });

  it('counts research from all research levels', () => {
    const state = createNewGameState();
    state.research.weaponsTechnology = 3;
    state.research.shieldingTechnology = 2;
    const scores = computePlayerScores(state);
    expect(scores.research).toBe(5);
  });

  it('counts military from combat ship weaponPower × count', () => {
    const state = createNewGameState();
    // lightFighter weaponPower = 50
    state.planets[0].ships.lightFighter = 10;
    const scores = computePlayerScores(state);
    expect(scores.military).toBe(50 * 10); // no tech bonus at level 0
  });

  it('excludes non-combat ships from military score', () => {
    const state = createNewGameState();
    state.planets[0].ships.recycler = 100;
    state.planets[0].ships.espionageProbe = 100;
    state.planets[0].ships.colonyShip = 10;
    state.planets[0].ships.solarSatellite = 50;
    const scores = computePlayerScores(state);
    expect(scores.military).toBe(0);
  });

  it('total is weighted composite', () => {
    const state = createNewGameState();
    state.planets[0].ships.lightFighter = 10; // base military = 500
    state.planets[0].buildings.metalMine = 5; // economy = 5
    state.research.weaponsTechnology = 1; // research = 1
    const scores = computePlayerScores(state);
    // total = military*2 + economy*5 + research*3
    expect(scores.total).toBe(550 * 2 + 5 * 5 + 1 * 3);
  });
});
