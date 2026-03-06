import { generateNPCColonies } from '../GalaxyEngine';

describe('NPCColony catch-up fields', () => {
  it('newly generated colonies have targetTier === tier', () => {
    const colonies = generateNPCColonies(42);
    for (const colony of colonies) {
      expect(colony.targetTier).toBe(colony.tier);
    }
  });

  it('catchUpUpgradeIntervalMs is initialUpgradeIntervalMs / 4', () => {
    const colonies = generateNPCColonies(42);
    for (const colony of colonies) {
      expect(colony.catchUpUpgradeIntervalMs).toBe(colony.initialUpgradeIntervalMs / 4);
    }
  });

  it('catchUpProgressTicks starts at 0', () => {
    const colonies = generateNPCColonies(42);
    for (const colony of colonies) {
      expect(colony.catchUpProgressTicks).toBe(0);
    }
  });
});
