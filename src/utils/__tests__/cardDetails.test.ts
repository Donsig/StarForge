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

import {
  buildingBenefitAtLevel,
  cardStatsFor,
  researchBenefitAtLevel,
} from '../cardDetails.ts';

describe('buildingBenefitAtLevel', () => {
  it('formats metal mine production at level 7 as +N/h', () => {
    const state = createMockGameContext({
      gameState: {
        planet: { buildings: { metalMine: 7 } },
        research: { plasmaTechnology: 0 },
      },
    }).gameState;

    expect(buildingBenefitAtLevel('metalMine', 7, state)).toMatch(/^\+[\d,]+\/h$/);
  });

  it('formats solar plant energy without an hourly suffix', () => {
    const state = createMockGameContext().gameState;

    expect(buildingBenefitAtLevel('solarPlant', 6, state)).toMatch(/^\+\d+$/);
  });

  it('formats storage capacity with the compact number helper', () => {
    const state = createMockGameContext().gameState;

    expect(buildingBenefitAtLevel('metalStorage', 5, state)).toMatch(/^\d+K$/);
  });

  it('formats robotics factory as build-time reduction', () => {
    const state = createMockGameContext().gameState;

    expect(buildingBenefitAtLevel('roboticsFactory', 4, state)).toMatch(
      /^−\d+% build time$/,
    );
  });

  it('formats fusion as combined energy and deuterium consumption', () => {
    const state = createMockGameContext({
      gameState: { research: { energyTechnology: 5 } },
    }).gameState;

    expect(buildingBenefitAtLevel('fusionReactor', 7, state)).toMatch(
      /^\+[\d.KM,]+ \/ −[\d.KM,]+\/h$/,
    );
  });
});

describe('researchBenefitAtLevel', () => {
  it('weaponsTechnology grants +10% attack per level', () => {
    expect(researchBenefitAtLevel('weaponsTechnology', 3)).toBe('+30% attack');
  });

  it('computerTechnology grants +1 fleet slot per level', () => {
    expect(researchBenefitAtLevel('computerTechnology', 5)).toBe('+5 fleet slots');
  });

  it('astrophysicsTechnology grants +1 colony per 2 levels', () => {
    expect(researchBenefitAtLevel('astrophysicsTechnology', 4)).toBe('+2 colonies');
  });

  it('falls back to a generic level label for drive research', () => {
    expect(researchBenefitAtLevel('combustionDrive', 2)).toBe('Lv 2');
  });
});

describe('cardStatsFor', () => {
  it('returns RAW combat stats for ships without research scaling', () => {
    const state = createMockGameContext({
      gameState: { research: { weaponsTechnology: 5 } },
    }).gameState;

    expect(
      cardStatsFor('ship', 'cruiser', state).find((stat) => stat.label === 'ATK')
        ?.value,
    ).toBe('400');
  });

  it('adds Energy / unit stat for solarSatellite', () => {
    const state = createMockGameContext({
      gameState: { planet: { maxTemperature: 80 } },
    }).gameState;

    expect(
      cardStatsFor('ship', 'solarSatellite', state).find(
        (stat) => stat.label === 'Energy / unit',
      )?.value,
    ).toBe('36');
  });

  it('handles non-finite solarSatellite temperature defensively', () => {
    const state = createMockGameContext({
      gameState: { planet: { maxTemperature: Number.NaN } },
    }).gameState;

    expect(
      cardStatsFor('ship', 'solarSatellite', state).find(
        (stat) => stat.label === 'Energy / unit',
      )?.value,
    ).toBe('0');
  });
});

import {
  buildingProgression,
  researchProgression,
} from '../cardDetails.ts';
import type { QueueItem } from '../../models/types.ts';

function makeQueueItem(
  type: QueueItem['type'],
  id: string,
  targetLevel: number,
  sourcePlanetIndex?: number,
): QueueItem {
  return {
    type,
    id,
    targetLevel,
    sourcePlanetIndex,
    startedAt: 0,
    completesAt: 0,
  };
}

describe('buildingProgression', () => {
  it('returns rows 5..10 for currentLevel=7 with an empty queue', () => {
    const state = createMockGameContext({
      gameState: {
        planet: { buildings: { metalMine: 7 } },
      },
    }).gameState;

    const rows = buildingProgression('metalMine', 7, [], state);

    expect(rows.map((row) => row.level)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(rows.find((row) => row.level === 7)).toMatchObject({
      current: true,
      queued: false,
      next: false,
    });
    expect(rows.find((row) => row.level === 8)).toMatchObject({
      current: false,
      queued: false,
      next: true,
    });
  });

  it('expands the range when queued levels push NEXT past current+3', () => {
    const state = createMockGameContext({
      gameState: {
        planet: { buildings: { metalMine: 7 } },
      },
    }).gameState;
    const queue = [8, 9, 10, 11].map((level) =>
      makeQueueItem('building', 'metalMine', level),
    );

    const rows = buildingProgression('metalMine', 7, queue, state);

    expect(rows.map((row) => row.level)).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    expect(rows.find((row) => row.level === 12)?.next).toBe(true);
  });

  it('never returns rows below level 1', () => {
    const state = createMockGameContext({
      gameState: {
        planet: { buildings: { solarPlant: 1 } },
      },
    }).gameState;

    const rows = buildingProgression('solarPlant', 1, [], state);

    expect(rows[0]?.level).toBe(1);
    expect(rows.map((row) => row.level)).toEqual([1, 2, 3, 4]);
  });

  it('marks queued/current/next flags without overlap', () => {
    const state = createMockGameContext({
      gameState: {
        planet: { buildings: { metalMine: 7 } },
      },
    }).gameState;
    const queue = [8, 9].map((level) =>
      makeQueueItem('building', 'metalMine', level),
    );

    const rows = buildingProgression('metalMine', 7, queue, state);
    const row7 = rows.find((row) => row.level === 7);
    const row8 = rows.find((row) => row.level === 8);
    const row9 = rows.find((row) => row.level === 9);
    const row10 = rows.find((row) => row.level === 10);

    expect(row7).toMatchObject({ current: true, queued: false, next: false });
    expect(row8).toMatchObject({ current: false, queued: true, next: false });
    expect(row9).toMatchObject({ current: false, queued: true, next: false });
    expect(row10).toMatchObject({ current: false, queued: false, next: true });
    expect(
      rows.every(
        (row) => [row.current, row.queued, row.next].filter(Boolean).length <= 1,
      ),
    ).toBe(true);
  });

  it('uses signed energy deltas for consuming and producing buildings', () => {
    const state = createMockGameContext({
      gameState: {
        planet: { buildings: { metalMine: 1, solarPlant: 1 } },
      },
    }).gameState;

    expect(
      buildingProgression('metalMine', 1, [], state).find((row) => row.level === 1)
        ?.energy,
    ).toBeLessThan(0);
    expect(
      buildingProgression('solarPlant', 1, [], state).find((row) => row.level === 1)
        ?.energy,
    ).toBeGreaterThan(0);
  });
});

describe('researchProgression', () => {
  it('always starts at level 1', () => {
    const state = createMockGameContext({
      gameState: {
        research: { weaponsTechnology: 5 },
      },
    }).gameState;

    const rows = researchProgression('weaponsTechnology', 5, [], state);

    expect(rows[0]?.level).toBe(1);
    expect(rows.map((row) => row.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('counts queue entries by id only, ignoring sourcePlanetIndex differences', () => {
    const state = createMockGameContext({
      gameState: {
        research: { weaponsTechnology: 5 },
      },
      withMultiplePlanets: true,
    }).gameState;
    const queue = [
      makeQueueItem('research', 'weaponsTechnology', 6, 0),
      makeQueueItem('research', 'weaponsTechnology', 7, 1),
    ];

    const rows = researchProgression('weaponsTechnology', 5, queue, state);

    expect(rows.find((row) => row.level === 6)).toMatchObject({
      queued: true,
      next: false,
    });
    expect(rows.find((row) => row.level === 7)).toMatchObject({
      queued: true,
      next: false,
    });
    expect(rows.find((row) => row.level === 8)).toMatchObject({
      queued: false,
      next: true,
    });
    expect(rows.every((row) => row.energy === 0)).toBe(true);
  });
});
