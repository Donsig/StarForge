/// <reference types="vitest/globals" />
import { simulate } from '../CombatEngine.ts';

const ZERO_TECHS = {
  weaponsTechnology: 0,
  shieldingTechnology: 0,
  armourTechnology: 0,
};

describe('CombatEngine', () => {
  it('attacker wins when overwhelming defender fleet', () => {
    const result = simulate(
      {
        ships: { battleship: 3 },
        techs: ZERO_TECHS,
      },
      {
        ships: { lightFighter: 3 },
        defences: {},
        techs: ZERO_TECHS,
      },
      123,
    );

    expect(result.outcome).toBe('attacker_wins');
    expect(result.defenderEnd.ships.lightFighter ?? 0).toBe(0);
  });

  it('defender wins when attacker has no effective force', () => {
    const result = simulate(
      {
        ships: { smallCargo: 1 },
        techs: ZERO_TECHS,
      },
      {
        ships: {},
        defences: { plasmaTurret: 1 },
        techs: ZERO_TECHS,
      },
      999,
    );

    expect(result.outcome).toBe('defender_wins');
    expect(result.attackerEnd.ships.smallCargo ?? 0).toBe(0);
  });

  it('returns draw after 6 rounds if both sides survive', () => {
    const result = simulate(
      {
        ships: { smallCargo: 1 },
        techs: ZERO_TECHS,
      },
      {
        ships: {},
        defences: { smallShieldDome: 1 },
        techs: ZERO_TECHS,
      },
      77,
    );

    expect(result.outcome).toBe('draw');
    expect(result.rounds).toBe(6);
    expect(result.attackerEnd.ships.smallCargo ?? 0).toBe(1);
    expect(result.defenderEnd.defences?.smallShieldDome ?? 0).toBe(1);
  });

  it('supports rapid-fire chaining that can clear multiple targets in one round', () => {
    let chainSeed: number | null = null;
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = simulate(
        {
          ships: { battlecruiser: 1 },
          techs: ZERO_TECHS,
        },
        {
          ships: { smallCargo: 2 },
          defences: {},
          techs: ZERO_TECHS,
        },
        seed,
      );

      if (result.rounds === 1 && (result.defenderEnd.ships.smallCargo ?? 0) === 0) {
        chainSeed = seed;
        break;
      }
    }

    expect(chainSeed).not.toBeNull();
  });

  it('applies the 1% shield rule and prevents chip damage from low attack shots', () => {
    const result = simulate(
      {
        ships: { recycler: 800 },
        techs: ZERO_TECHS,
      },
      {
        ships: {},
        defences: { ionCannon: 1 },
        techs: ZERO_TECHS,
      },
      2026,
    );

    expect(result.outcome).toBe('draw');
    expect(result.defenderEnd.defences?.ionCannon ?? 0).toBe(1);
    expect(result.defenderLosses.defences?.ionCannon ?? 0).toBe(0);
  });

  it('calculates debris from destroyed ships only', () => {
    const result = simulate(
      {
        ships: { battleship: 1 },
        techs: ZERO_TECHS,
      },
      {
        ships: { lightFighter: 1 },
        defences: { rocketLauncher: 1 },
        techs: ZERO_TECHS,
      },
      314,
    );

    // 1x light fighter destroyed => 30% of 3000 metal and 1000 crystal.
    expect(result.debrisCreated).toEqual({
      metal: 900,
      crystal: 300,
    });
  });
});
