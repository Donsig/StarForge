import { describe, expect, it } from 'vitest';
import {
  TYPE_ACCENTS,
  enablesFor,
  maxAffordable,
  prereqRowsFor,
} from '../cardDetails.ts';
import { createMockGameContext } from '../../test/test-utils.tsx';
import type { GameState } from '../../models/GameState.ts';
import type { ResourcesState } from '../../models/Planet.ts';

describe('TYPE_ACCENTS', () => {
  it('exposes all four card types with the spec colour values', () => {
    expect(TYPE_ACCENTS.building.c).toBe('#4d8fff');
    expect(TYPE_ACCENTS.research.c).toBe('#818cf8');
    expect(TYPE_ACCENTS.ship.c).toBe('#30d5c8');
    expect(TYPE_ACCENTS.defence.c).toBe('#f0a832');
  });
});

describe('maxAffordable', () => {
  const r: ResourcesState = {
    metal: 10000,
    crystal: 5000,
    deuterium: 2000,
    energyProduction: 0,
    energyConsumption: 0,
  };

  it('returns the limiting min across resources', () => {
    expect(maxAffordable({ metal: 1000, crystal: 1000, deuterium: 0 }, r)).toBe(5);
  });

  it('returns 0 when not affordable at qty 1', () => {
    expect(maxAffordable({ metal: 999999, crystal: 0, deuterium: 0 }, r)).toBe(0);
  });

  it('clamps to maxCount minus existing (built or queued)', () => {
    expect(
      maxAffordable({ metal: 100, crystal: 100, deuterium: 0 }, r, 1, 0),
    ).toBe(1);
    expect(
      maxAffordable({ metal: 100, crystal: 100, deuterium: 0 }, r, 1, 1),
    ).toBe(0);
  });

  it('handles zero-cost resources without dividing by zero', () => {
    expect(maxAffordable({ metal: 0, crystal: 0, deuterium: 100 }, r)).toBe(20);
  });
});

describe('prereqRowsFor', () => {
  function makeState(): GameState {
    return createMockGameContext().gameState;
  }

  it('returns empty array for empty input', () => {
    expect(prereqRowsFor([], makeState())).toEqual([]);
  });

  it('marks prereqs met/unmet correctly', () => {
    const state = createMockGameContext({
      gameState: {
        planet: { buildings: { shipyard: 5 } },
        research: { combustionDrive: 0 },
      },
    }).gameState;

    const rows = prereqRowsFor(
      [
        { type: 'building', id: 'shipyard', level: 5 },
        { type: 'research', id: 'combustionDrive', level: 1 },
      ],
      state,
    );

    expect(rows[0]).toEqual({
      label: 'Shipyard 5',
      met: true,
      target: { type: 'building', id: 'shipyard' },
    });
    expect(rows[1]).toEqual({
      label: 'Combustion Drive 1',
      met: false,
      target: { type: 'research', id: 'combustionDrive' },
    });
  });

  it('returns target=null when prereq id is unknown (data drift)', () => {
    const rows = prereqRowsFor(
      [{ type: 'building', id: 'nonexistentXyz', level: 1 }],
      makeState(),
    );
    expect(rows[0].target).toBeNull();
    expect(rows[0].label).toContain('nonexistentXyz');
  });
});

describe('enablesFor', () => {
  it('returns empty array for items that unlock nothing', () => {
    expect(enablesFor('building', 'metalMine')).toEqual([]);
  });

  it('lists ships unlocked by shipyard at the correct level', () => {
    const out = enablesFor('building', 'shipyard');
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((u) => typeof u.atLevel === 'number')).toBe(true);
  });

  it('lists defences unlocked by weaponsTechnology', () => {
    const out = enablesFor('research', 'weaponsTechnology');
    expect(out.find((u) => u.id === 'gaussCannon')).toBeDefined();
  });
});
