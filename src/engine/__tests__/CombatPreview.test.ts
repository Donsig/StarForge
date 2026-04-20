/// <reference types="vitest/globals" />
// @ts-expect-error simulatePreview does not yet exist — created by dev subagent in Task 19
import { simulatePreview } from '../CombatEngine.ts';
import type { CombatPreview } from '../CombatEngine.ts';

const ZERO_TECHS = {
  weaponsTechnology: 0,
  shieldingTechnology: 0,
  armourTechnology: 0,
};

const HIGH_TECHS = {
  weaponsTechnology: 10,
  shieldingTechnology: 10,
  armourTechnology: 10,
};

const SEED = 42;

describe('simulatePreview', () => {
  it('exports simulatePreview as a function', () => {
    expect(typeof simulatePreview).toBe('function');
  });

  it('returns winProbability >= 0.95 for an overwhelming attacker', () => {
    // 500 battleships vs 1 light fighter — attacker should almost always win
    const preview: CombatPreview = simulatePreview(
      { ships: { battleship: 500 }, techs: ZERO_TECHS },
      { ships: { lightFighter: 1 }, defences: {}, techs: ZERO_TECHS },
      SEED,
    );

    expect(preview.winProbability).toBeGreaterThanOrEqual(0.95);
  });

  it('returns winProbability <= 0.05 for a hopeless attacker', () => {
    // 5 light fighters vs 500 battleships + 100 plasma turrets — attacker should almost always lose
    const preview: CombatPreview = simulatePreview(
      { ships: { lightFighter: 5 }, techs: ZERO_TECHS },
      { ships: { battleship: 500 }, defences: { plasmaTurret: 100 }, techs: ZERO_TECHS },
      SEED,
    );

    expect(preview.winProbability).toBeLessThanOrEqual(0.05);
  });

  it('returns winProbability between 0.2 and 0.8 for a near-even match', () => {
    // 10 cruisers vs 5 battleships + 5 rocket launchers — competitive match.
    // Wide tolerance (0.2–0.8) ensures the test is not flaky across seeds.
    const preview: CombatPreview = simulatePreview(
      { ships: { cruiser: 10 }, techs: ZERO_TECHS },
      { ships: { battleship: 5 }, defences: { rocketLauncher: 5 }, techs: ZERO_TECHS },
      SEED,
    );

    expect(preview.winProbability).toBeGreaterThanOrEqual(0.2);
    expect(preview.winProbability).toBeLessThanOrEqual(0.8);
  });

  it('is deterministic — same inputs + seedBase + trials yield identical output', () => {
    const args = [
      { ships: { battleship: 10 }, techs: ZERO_TECHS },
      { ships: { cruiser: 8 }, defences: { rocketLauncher: 20 }, techs: ZERO_TECHS },
      SEED,
      5,
    ] as const;

    const first: CombatPreview = simulatePreview(...args);
    const second: CombatPreview = simulatePreview(...args);

    expect(first).toEqual(second);
  });

  it('uses 10 trials by default', () => {
    const preview: CombatPreview = simulatePreview(
      { ships: { battleship: 5 }, techs: ZERO_TECHS },
      { ships: {}, defences: { rocketLauncher: 10 }, techs: ZERO_TECHS },
      SEED,
    );

    expect(preview.trials).toBe(10);
  });

  it('accepts a custom trial count', () => {
    const preview: CombatPreview = simulatePreview(
      { ships: { battleship: 5 }, techs: ZERO_TECHS },
      { ships: {}, defences: { rocketLauncher: 10 }, techs: ZERO_TECHS },
      SEED,
      5,
    );

    expect(preview.trials).toBe(5);
  });

  it('winProbability + drawProbability + lossProbability sum to 1 within floating-point tolerance', () => {
    const preview: CombatPreview = simulatePreview(
      { ships: { cruiser: 5, battleship: 2 }, techs: ZERO_TECHS },
      { ships: { lightFighter: 10 }, defences: { lightLaser: 5 }, techs: ZERO_TECHS },
      SEED,
    );

    const lossProbability = 1 - preview.winProbability - preview.drawProbability;
    const total = preview.winProbability + preview.drawProbability + lossProbability;
    expect(total).toBeCloseTo(1, 10);
    expect(preview.winProbability + preview.drawProbability).toBeLessThanOrEqual(1 + 1e-10);
    expect(preview.winProbability).toBeGreaterThanOrEqual(0);
    expect(preview.drawProbability).toBeGreaterThanOrEqual(0);
  });

  it('averageRounds is positive for non-trivial combat', () => {
    const preview: CombatPreview = simulatePreview(
      { ships: { battleship: 3 }, techs: ZERO_TECHS },
      { ships: { lightFighter: 3 }, defences: {}, techs: ZERO_TECHS },
      SEED,
    );

    expect(preview.averageRounds).toBeGreaterThan(0);
  });

  it('averageAttackerLosses only includes unit ids with > 0 average', () => {
    // Attacker has multiple ship types; losses object should only contain ships that were actually lost
    const preview: CombatPreview = simulatePreview(
      { ships: { lightFighter: 50, battleship: 50 }, techs: ZERO_TECHS },
      { ships: { cruiser: 5 }, defences: { rocketLauncher: 5 }, techs: ZERO_TECHS },
      SEED,
    );

    for (const value of Object.values(preview.averageAttackerLosses)) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it('handles empty defender (no ships, no defences) — winProbability is 1', () => {
    const preview: CombatPreview = simulatePreview(
      { ships: { lightFighter: 1 }, techs: ZERO_TECHS },
      { ships: {}, defences: {}, techs: ZERO_TECHS },
      SEED,
    );

    expect(preview.winProbability).toBeCloseTo(1, 5);
  });

  it('handles empty attacker — winProbability is 0 (defender wins all trials)', () => {
    // If simulate() throws for an empty attacker, this test documents that behaviour.
    // If it returns defender_wins, winProbability should be 0.
    let preview: CombatPreview | null = null;
    let threw = false;

    try {
      preview = simulatePreview(
        { ships: {}, techs: ZERO_TECHS },
        { ships: { lightFighter: 5 }, defences: {}, techs: ZERO_TECHS },
        SEED,
      );
    } catch {
      threw = true;
    }

    if (!threw) {
      expect(preview).not.toBeNull();
      // If it doesn't throw, attacker should never win with no ships
      expect(preview!.winProbability).toBe(0);
    } else {
      // Acceptable: simulate throws on empty attacker. Flag for implementation to handle.
      expect(threw).toBe(true);
    }
  });

  it('tech levels affect win probability — higher attacker tech raises winProbability', () => {
    // Same moderate fleets; tech-10 attacker should win more often than tech-0 attacker
    const fleet = {
      attacker: { ships: { cruiser: 8 } },
      defender: { ships: { battleship: 5 }, defences: { rocketLauncher: 10 } },
    };

    const lowTech: CombatPreview = simulatePreview(
      { ...fleet.attacker, techs: ZERO_TECHS },
      { ...fleet.defender, techs: ZERO_TECHS },
      SEED,
      20,
    );

    const highTech: CombatPreview = simulatePreview(
      { ...fleet.attacker, techs: HIGH_TECHS },
      { ...fleet.defender, techs: ZERO_TECHS },
      SEED,
      20,
    );

    expect(highTech.winProbability).toBeGreaterThanOrEqual(lowTech.winProbability);
  });
});
