/// <reference types="vitest/globals" />

import { createNewGameState } from '../../models/GameState.ts';
import type { NPCColony } from '../../models/Galaxy.ts';
import {
  calcDetectionChance,
  calcNPCEspionageLevel,
  generateReport,
} from '../EspionageEngine.ts';

function createResearch(espionageTechnology: number) {
  const state = createNewGameState();
  state.research.espionageTechnology = espionageTechnology;
  return state.research;
}

function createColony(overrides: Partial<NPCColony> = {}): NPCColony {
  return {
    coordinates: { galaxy: 1, system: 2, slot: 7 },
    name: 'Test Colony',
    tier: 8,
    specialty: 'balanced',
    maxTier: 10,
    initialUpgradeIntervalMs: 5_400_000,
    currentUpgradeIntervalMs: 5_400_000,
    lastUpgradeAt: 0,
    upgradeTickCount: 0,
    raidCount: 0,
    recentRaidTimestamps: [],
    abandonedAt: undefined,
    buildings: {
      metalMine: 12,
      crystalMine: 10,
      deuteriumSynthesizer: 8,
      solarPlant: 14,
    },
    baseDefences: {
      rocketLauncher: 64,
      lightLaser: 24,
      heavyLaser: 8,
    },
    baseShips: {
      lightFighter: 28,
      heavyFighter: 12,
      cruiser: 4,
      smallCargo: 12,
    },
    currentDefences: {
      rocketLauncher: 10,
      lightLaser: 3,
      heavyLaser: 1,
    },
    currentShips: {
      lightFighter: 4,
      heavyFighter: 1,
      cruiser: 0,
      smallCargo: 2,
    },
    lastRaidedAt: 0,
    resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
    ...overrides,
    temperature: overrides.temperature ?? 35,
  };
}

describe('EspionageEngine', () => {
  describe('calcNPCEspionageLevel', () => {
    it('derives npc espionage level from colony tier', () => {
      expect(calcNPCEspionageLevel(createColony({ tier: 1 }))).toBe(0);
      expect(calcNPCEspionageLevel(createColony({ tier: 4 }))).toBe(2);
      expect(calcNPCEspionageLevel(createColony({ tier: 9 }))).toBe(4);
    });

    it('uses research lab level for researcher specialty colonies', () => {
      const researcher = createColony({
        specialty: 'researcher',
        tier: 4,
        buildings: {
          ...createColony().buildings,
          researchLab: 9,
        },
      });

      expect(calcNPCEspionageLevel(researcher)).toBe(4);
    });
  });

  describe('calcDetectionChance', () => {
    it('returns 0 when npc espionage level is 0', () => {
      expect(calcDetectionChance(0, 0, 0)).toBe(0);
      expect(calcDetectionChance(0, 3, 7)).toBe(0);
    });

    it('guarantees detection when player tech is 0 or probe count is invalid', () => {
      expect(calcDetectionChance(2, 0, 5)).toBe(1);
      expect(calcDetectionChance(2, 4, 0)).toBe(1);
    });

    it('matches the expected ratio-squared formula with clamping', () => {
      expect(calcDetectionChance(2, 1, 1)).toBe(1);
      expect(calcDetectionChance(2, 2, 2)).toBeCloseTo(0.25, 8);
      expect(calcDetectionChance(4, 8, 2)).toBeCloseTo(0.0625, 8);
    });
  });

  describe('generateReport', () => {
    it('stores detectionChance on the report', () => {
      const colony = createColony({ tier: 1 });
      const research = createResearch(2);
      const rng = () => 0.99;

      const report = generateReport(colony, Date.now(), 0, 5, research, 1, rng);

      expect(typeof report.detectionChance).toBe('number');
      expect(report.detectionChance).toBeGreaterThanOrEqual(0);
      expect(report.detectionChance).toBeLessThanOrEqual(1);
    });

    it('stores detectionChance = 0 when npcEspionageLevel is 0', () => {
      const colony = createColony({ tier: 1 });
      const research = createResearch(1);
      const rng = () => 0.5;

      const report = generateReport(colony, Date.now(), 0, 1, research, 1, rng);

      expect(report.detectionChance).toBe(0);
    });

    it('returns no intel fields when probes are detected', () => {
      const now = 50_000;
      const colony = createColony({ tier: 10 });
      const report = generateReport(colony, now, 0, 1, createResearch(1), 1, () => 0.5);

      expect(report.detected).toBe(true);
      expect(report.probesLost).toBe(1);
      expect(report.resources).toBeUndefined();
      expect(report.fleet).toBeUndefined();
      expect(report.defences).toBeUndefined();
      expect(report.buildings).toBeUndefined();
      expect(report.tier).toBeUndefined();
      expect(report.rebuildStatus).toBeUndefined();
      expect(report.abandonmentProximity).toBeUndefined();
    });

    it('gates intel tiers by player espionage technology on undetected scans', () => {
      const now = 5 * 3600 * 1000;
      const colony = createColony();

      const tech1 = generateReport(colony, now, 0, 5, createResearch(1), 1, () => 1);
      expect(tech1.detected).toBe(false);
      expect(tech1.probesLost).toBe(0);
      expect(tech1.resources).toBeDefined();
      expect(tech1.abandonmentProximity).toEqual({
        status: 'stable',
        recentRaidCount: 0,
        raidThreshold: 3,
        progressPct: 0,
        windowGameHours: 24,
        lastRaidGameHoursAgo: undefined,
        pressureWindowExpiresInGameHours: undefined,
      });
      expect(tech1.fleet).toBeUndefined();
      expect(tech1.defences).toBeUndefined();
      expect(tech1.buildings).toBeUndefined();
      expect(tech1.tier).toBeUndefined();

      const tech2 = generateReport(colony, now, 0, 5, createResearch(2), 1, () => 1);
      expect(tech2.fleet).toBeDefined();
      expect(tech2.defences).toBeUndefined();

      const tech4 = generateReport(colony, now, 0, 5, createResearch(4), 1, () => 1);
      expect(tech4.defences).toBeDefined();
      expect(tech4.buildings).toBeUndefined();
      expect(tech4.tier).toBeUndefined();

      const tech6 = generateReport(colony, now, 0, 5, createResearch(6), 1, () => 1);
      expect(tech6.buildings).toBeDefined();
      expect(tech6.tier).toBe(colony.tier);
      expect(tech6.specialty).toBe(colony.specialty);
    });

    it('includes rebuild status at tech >= 8 and shows 100% for never-raided colonies', () => {
      const now = 3 * 24 * 3600 * 1000;
      const twelveHoursMs = 12 * 3600 * 1000;
      const raidedColony = createColony({ lastRaidedAt: now - twelveHoursMs });

      const tech8WithRaid = generateReport(raidedColony, now, 0, 5, createResearch(8), 1, () => 1);
      expect(tech8WithRaid.rebuildStatus).toEqual({
        defencePct: 25,
        fleetPct: 25,
      });

      const tech7WithRaid = generateReport(raidedColony, now, 0, 5, createResearch(7), 1, () => 1);
      expect(tech7WithRaid.rebuildStatus).toBeUndefined();

      const tech8NoRaid = generateReport(
        createColony({ lastRaidedAt: 0 }),
        now,
        0,
        5,
        createResearch(8),
        1,
        () => 1,
      );
      expect(tech8NoRaid.rebuildStatus).toEqual({
        defencePct: 100,
        fleetPct: 100,
      });
    });

    it('includes abandonment proximity from recent raid pressure', () => {
      const now = 24 * 3600 * 1000;
      const oneGameHourMs = 3600 * 1000;
      const colony = createColony({
        recentRaidTimestamps: [
          now - (2 * oneGameHourMs),
          now - (5 * oneGameHourMs),
        ],
      });

      const report = generateReport(colony, now, 0, 5, createResearch(1), 1, () => 1);

      expect(report.abandonmentProximity).toEqual({
        status: 'atRisk',
        recentRaidCount: 2,
        raidThreshold: 3,
        progressPct: 67,
        windowGameHours: 24,
        lastRaidGameHoursAgo: 2,
        pressureWindowExpiresInGameHours: 19,
      });
    });
  });
});
