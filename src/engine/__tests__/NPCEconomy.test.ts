/// <reference types="vitest/globals" />

// Local types mirror the upcoming v18 NPCColony shape (resources field replaces resourcesAtLastRaid).
// Delete these when Galaxy.ts ships the v18 rename.
interface ResourceBalance {
  metal: number;
  crystal: number;
  deuterium: number;
}

interface NPCColonyV18 {
  coordinates: { galaxy: number; system: number; slot: number };
  name: string;
  temperature: number;
  tier: number;
  specialty: string;
  maxTier: number;
  initialUpgradeIntervalMs: number;
  currentUpgradeIntervalMs: number;
  targetTier: number;
  catchUpUpgradeIntervalMs: number;
  catchUpProgressTicks: number;
  lastUpgradeAt: number;
  upgradeTickCount: number;
  raidCount: number;
  recentRaidTimestamps: number[];
  abandonedAt?: number;
  buildings: Record<string, number>;
  baseDefences: Record<string, number>;
  baseShips: Record<string, number>;
  currentDefences: Record<string, number>;
  currentShips: Record<string, number>;
  lastRaidedAt: number;
  resources: ResourceBalance; // v18: running balance (replaces resourcesAtLastRaid)
}

// Helper to build a minimal v18-shaped colony for use in accrueNpcResources tests.
// Once Galaxy.ts ships v18, this can import NPCColony directly.
function makeV18Colony(overrides: Partial<NPCColonyV18> = {}): NPCColonyV18 {
  return {
    coordinates: { galaxy: 1, system: 5, slot: 8 },
    name: 'Test Colony',
    temperature: 50,
    tier: 6,
    specialty: 'balanced',
    maxTier: 8,
    initialUpgradeIntervalMs: 10_800_000,
    currentUpgradeIntervalMs: 10_800_000,
    targetTier: 6,
    catchUpUpgradeIntervalMs: 2_700_000,
    catchUpProgressTicks: 0,
    lastUpgradeAt: 0,
    upgradeTickCount: 0,
    raidCount: 0,
    recentRaidTimestamps: [],
    abandonedAt: undefined,
    buildings: {
      metalMine: 12,
      crystalMine: 9,
      deuteriumSynthesizer: 7,
      solarPlant: 14,
      fusionReactor: 0,
      metalStorage: 4,
      crystalStorage: 4,
      deuteriumTank: 3,
      roboticsFactory: 3,
      naniteFactory: 0,
      shipyard: 4,
      researchLab: 2,
    },
    baseDefences: { rocketLauncher: 40, lightLaser: 18 },
    baseShips: { lightFighter: 30, solarSatellite: 9 },
    currentDefences: { rocketLauncher: 40, lightLaser: 18 },
    currentShips: { lightFighter: 30, solarSatellite: 9 },
    lastRaidedAt: 0,
    resources: { metal: 0, crystal: 0, deuterium: 0 },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// accrueNpcResources tests
// These tests target the NEW `accrueNpcResources` export from GalaxyEngine.ts.
// They will FAIL until that function is added to production code.
// ─────────────────────────────────────────────────────────────────────────────

describe('accrueNpcResources', () => {
  it('accrues metal, crystal, deuterium proportional to elapsed time', async () => {
    // Import the as-yet-unshipped function — will throw module/export error until impl ships.
    const { accrueNpcResources } = await import('../GalaxyEngine.ts');

    // Colony with tier-6 buildings produces meaningful resources.
    // We cast to any to avoid compile-time NPCColony shape errors until v18 ships.
    const colony = makeV18Colony({ resources: { metal: 0, crystal: 0, deuterium: 0 } });
    const oneHourMs = 3_600_000;
    const gameSpeed = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accrueNpcResources(colony as any, oneHourMs, gameSpeed);

    // After 1 game-hour at speed=1, metal should be > 0 (tier-6 mine at level 12)
    expect(colony.resources.metal).toBeGreaterThan(0);
    expect(colony.resources.crystal).toBeGreaterThan(0);
    // Deuterium may be near 0 at high temperature; just check non-negative
    expect(colony.resources.deuterium).toBeGreaterThanOrEqual(0);
  });

  it('does not accrue for abandoned colony', async () => {
    const { accrueNpcResources } = await import('../GalaxyEngine.ts');

    const colony = makeV18Colony({
      abandonedAt: Date.now() - 1000,
      resources: { metal: 500, crystal: 300, deuterium: 100 },
    });
    const before = { ...colony.resources };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accrueNpcResources(colony as any, 3_600_000, 1);

    expect(colony.resources.metal).toBe(before.metal);
    expect(colony.resources.crystal).toBe(before.crystal);
    expect(colony.resources.deuterium).toBe(before.deuterium);
  });

  it('scales with gameSpeed — gameSpeed=10 accrues 10x vs gameSpeed=1 for same real elapsed time', async () => {
    const { accrueNpcResources } = await import('../GalaxyEngine.ts');

    const elapsedMs = 3_600_000; // 1 real hour

    const colonySpeed1 = makeV18Colony({ resources: { metal: 0, crystal: 0, deuterium: 0 } });
    const colonySpeed10 = makeV18Colony({ resources: { metal: 0, crystal: 0, deuterium: 0 } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accrueNpcResources(colonySpeed1 as any, elapsedMs, 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accrueNpcResources(colonySpeed10 as any, elapsedMs, 10);

    // At speed=10, 1 real hour = 10 game-hours → 10× production
    // Allow a tiny floating-point tolerance of 1 unit
    expect(colonySpeed10.resources.metal).toBeCloseTo(colonySpeed1.resources.metal * 10, 0);
    expect(colonySpeed10.resources.crystal).toBeCloseTo(colonySpeed1.resources.crystal * 10, 0);
  });

  it('does not cap accrual — accruing for 200 game-hours exceeds old 48h ceiling', async () => {
    const { accrueNpcResources } = await import('../GalaxyEngine.ts');

    // 200 game-hours at speed=1
    const twoHundredHoursMs = 200 * 3_600_000;
    const colony = makeV18Colony({ resources: { metal: 0, crystal: 0, deuterium: 0 } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accrueNpcResources(colony as any, twoHundredHoursMs, 1);

    // Also compute 48-hour amount for the same colony to compare
    const colony48 = makeV18Colony({ resources: { metal: 0, crystal: 0, deuterium: 0 } });
    const fortyEightHoursMs = 48 * 3_600_000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accrueNpcResources(colony48 as any, fortyEightHoursMs, 1);

    // 200h balance should be strictly greater than 48h balance (no artificial cap)
    expect(colony.resources.metal).toBeGreaterThan(colony48.resources.metal);
    expect(colony.resources.crystal).toBeGreaterThan(colony48.resources.crystal);
  });

  it('leaves buildings, ships, and defences untouched after accrual', async () => {
    const { accrueNpcResources } = await import('../GalaxyEngine.ts');

    const colony = makeV18Colony({ resources: { metal: 100, crystal: 50, deuterium: 10 } });
    const originalBuildings = JSON.stringify(colony.buildings);
    const originalShips = JSON.stringify(colony.baseShips);
    const originalDefences = JSON.stringify(colony.baseDefences);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accrueNpcResources(colony as any, 3_600_000, 1);

    expect(JSON.stringify(colony.buildings)).toBe(originalBuildings);
    expect(JSON.stringify(colony.baseShips)).toBe(originalShips);
    expect(JSON.stringify(colony.baseDefences)).toBe(originalDefences);
  });

  it('handles zero elapsed time — resources unchanged', async () => {
    const { accrueNpcResources } = await import('../GalaxyEngine.ts');

    const colony = makeV18Colony({ resources: { metal: 1234, crystal: 567, deuterium: 89 } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accrueNpcResources(colony as any, 0, 1);

    expect(colony.resources.metal).toBe(1234);
    expect(colony.resources.crystal).toBe(567);
    expect(colony.resources.deuterium).toBe(89);
  });

  it('handles negative elapsed time gracefully — resources unchanged or same', async () => {
    const { accrueNpcResources } = await import('../GalaxyEngine.ts');

    const colony = makeV18Colony({ resources: { metal: 500, crystal: 200, deuterium: 50 } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accrueNpcResources(colony as any, -3_600_000, 1);

    // Negative elapsed should be clamped to 0 — no change
    expect(colony.resources.metal).toBe(500);
    expect(colony.resources.crystal).toBe(200);
    expect(colony.resources.deuterium).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getNPCResources (simplified) tests
// After Task 20 ships, getNPCResources becomes a direct lookup of colony.resources.
// These tests verify the new simplified contract.
// ─────────────────────────────────────────────────────────────────────────────

describe('getNPCResources (v18 simplified)', () => {
  it('returns the running balance directly from colony.resources', async () => {
    // Until v18 ships, getNPCResources still uses the old 3-arg signature & computation.
    // This test will FAIL on the old code because the old implementation ignores
    // colony.resources and computes from resourcesAtLastRaid + elapsed time.
    // After v18, it simply returns colony.resources.
    const { getNPCResources } = await import('../GalaxyEngine.ts');

    // We build a colony with the v18 `resources` field set to known values.
    // The old NPCColony type has `resourcesAtLastRaid`, not `resources`.
    // We use `as any` to bypass the type mismatch until v18 ships.
    const colony = makeV18Colony({
      resources: { metal: 99_000, crystal: 55_000, deuterium: 11_000 },
    });

    // Old signature: getNPCResources(colony, now, gameSpeed)
    // New signature: getNPCResources(colony) — extra args become optional/ignored.
    // We call with the minimal new signature; if old code exists it will compute
    // from elapsed time (not the stored resources), causing the test to fail.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = getNPCResources(colony as any);

    expect(result.metal).toBe(99_000);
    expect(result.crystal).toBe(55_000);
    expect(result.deuterium).toBe(11_000);
  });

  it('returns zero for an abandoned colony regardless of stored resources', async () => {
    const { getNPCResources } = await import('../GalaxyEngine.ts');

    const colony = makeV18Colony({
      abandonedAt: Date.now() - 5000,
      resources: { metal: 10_000, crystal: 5_000, deuterium: 2_000 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = getNPCResources(colony as any);

    expect(result).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
  });

  it('getNPCResources ignores now and gameSpeed parameters when provided', async () => {
    // Verifies the simplified contract: even if legacy args are passed, the result
    // comes from colony.resources, not from time-based computation.
    // This test fails against the old 3-arg time-based implementation.
    const { getNPCResources } = await import('../GalaxyEngine.ts');

    const colony = makeV18Colony({
      resources: { metal: 42_000, crystal: 21_000, deuterium: 7_000 },
    });

    // Pass wildly different now/gameSpeed — should not change the result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultA = getNPCResources(colony as any, 0, 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultB = getNPCResources(colony as any, 9_999_999_999_999, 100);

    expect(resultA).toEqual({ metal: 42_000, crystal: 21_000, deuterium: 7_000 });
    expect(resultB).toEqual(resultA);
  });
});
