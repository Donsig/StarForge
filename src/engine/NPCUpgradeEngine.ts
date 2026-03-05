import type { GameState } from '../models/GameState.ts';
import type {
  Coordinates,
  NPCAbandonmentProximity,
  NPCColony,
} from '../models/Galaxy.ts';

const NPC_RECOVERY_MS = 48 * 3600 * 1000;
const RAID_WINDOW_MS = 24 * 3600 * 1000;
const SAFE_RETURN_MS = 30_000;
const MAX_CATCHUP_REAL_MS = 7 * 24 * 3600 * 1000;
const MAX_UPGRADE_ITERATIONS = 500;

export const NPC_ABANDONMENT_RAID_THRESHOLD = 3;
export const NPC_ABANDONMENT_WINDOW_GAME_HOURS = 24;

/** Simple seedable PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sameCoords(a: Coordinates, b: Coordinates): boolean {
  return a.galaxy === b.galaxy && a.system === b.system && a.slot === b.slot;
}

function maxShipsForTier(colony: NPCColony, shipId: string): number {
  switch (shipId) {
    case 'lightFighter':
      return colony.tier * 25;
    case 'heavyFighter':
      return colony.tier * 15;
    case 'cruiser':
      return colony.tier * 10;
    case 'battleship':
      return colony.tier * 6;
    case 'battlecruiser':
      return colony.tier * 4;
    default:
      return Infinity;
  }
}

function maxDefencesForTier(colony: NPCColony, defenceId: string): number {
  switch (defenceId) {
    case 'rocketLauncher':
      return colony.tier * 40;
    case 'lightLaser':
      return colony.tier * 20;
    case 'heavyLaser':
      return colony.tier * 15;
    case 'ionCannon':
      return colony.tier * 10;
    case 'plasmaTurret':
      return colony.tier * 5;
    default:
      return Infinity;
  }
}

function addShip(colony: NPCColony, shipId: string, amount: number): void {
  const current = Math.max(0, Math.floor(colony.baseShips[shipId] ?? 0));
  const next = current + amount;
  colony.baseShips[shipId] = Math.min(next, maxShipsForTier(colony, shipId));
}

function addDefence(colony: NPCColony, defenceId: string, amount: number): void {
  const current = Math.max(0, Math.floor(colony.baseDefences[defenceId] ?? 0));
  const next = current + amount;
  colony.baseDefences[defenceId] = Math.min(next, maxDefencesForTier(colony, defenceId));
}

function upgradeBuilding(colony: NPCColony, buildingId: string, maxLevel: number): boolean {
  const current = Math.max(0, Math.floor(colony.buildings[buildingId] ?? 0));
  if (current >= maxLevel) {
    return false;
  }
  colony.buildings[buildingId] = Math.min(maxLevel, current + 1);
  return true;
}

function applyBalancedFleetIncrement(colony: NPCColony): void {
  if (colony.tier >= 5) {
    addShip(colony, 'cruiser', 1);
    return;
  }
  addShip(colony, 'lightFighter', 3);
}

function applyBalancedDefenceIncrement(colony: NPCColony): void {
  if (colony.tier >= 6) {
    addDefence(colony, 'ionCannon', 1);
    return;
  }
  addDefence(colony, 'rocketLauncher', 5);
}

export function applyUpgradeIncrement(colony: NPCColony, rng: () => number): void {
  const maxBuildingLevel = colony.maxTier * 2;
  const phase = colony.upgradeTickCount;

  // Phase 2.6 spec currently uses deterministic upgrade tables.
  void rng;

  if (colony.specialty === 'turtle') {
    const step = phase % 3;
    if (step === 0 || step === 1) {
      if (colony.tier <= 4) {
        addDefence(colony, 'rocketLauncher', 5);
      } else if (colony.tier <= 6) {
        addDefence(colony, 'heavyLaser', 2);
      } else {
        addDefence(colony, 'plasmaTurret', 1);
      }
    } else {
      upgradeBuilding(colony, 'metalMine', maxBuildingLevel);
    }
  } else if (colony.specialty === 'fleeter') {
    const step = phase % 4;
    if (step === 0 || step === 1) {
      if (colony.tier <= 4) {
        addShip(colony, 'lightFighter', 3);
      } else if (colony.tier <= 6) {
        addShip(colony, 'cruiser', 2);
      } else {
        addShip(colony, 'battleship', 1);
      }
    } else if (step === 2) {
      upgradeBuilding(colony, 'metalMine', maxBuildingLevel);
    } else {
      upgradeBuilding(colony, 'crystalMine', maxBuildingLevel);
    }
  } else if (colony.specialty === 'miner') {
    const step = phase % 3;
    if (step === 0) {
      upgradeBuilding(colony, 'metalMine', maxBuildingLevel);
    } else if (step === 1) {
      upgradeBuilding(colony, 'crystalMine', maxBuildingLevel);
    } else {
      upgradeBuilding(colony, 'deuteriumSynthesizer', maxBuildingLevel);
      const cycle = Math.floor(phase / 3) + 1;
      if (cycle % 3 === 0) {
        upgradeBuilding(colony, 'metalStorage', maxBuildingLevel);
      }
    }
  } else if (colony.specialty === 'balanced') {
    const step = phase % 4;
    if (step === 0) {
      upgradeBuilding(colony, 'metalMine', maxBuildingLevel);
    } else if (step === 1) {
      applyBalancedFleetIncrement(colony);
    } else if (step === 2) {
      applyBalancedDefenceIncrement(colony);
    } else {
      upgradeBuilding(colony, 'crystalMine', maxBuildingLevel);
    }
  } else if (colony.specialty === 'raider') {
    const step = phase % 3;
    if (step === 0 || step === 1) {
      if (colony.tier <= 4) {
        addShip(colony, 'lightFighter', 4);
      } else if (colony.tier <= 6) {
        addShip(colony, 'cruiser', 3);
      } else {
        addShip(colony, 'battlecruiser', 2);
      }
    } else {
      addDefence(colony, 'rocketLauncher', 2);
    }
  } else if (colony.specialty === 'researcher') {
    const step = phase % 5;
    if (step === 4) {
      upgradeBuilding(colony, 'researchLab', colony.tier * 2);
    } else if (step % 2 === 0) {
      applyBalancedFleetIncrement(colony);
    } else {
      applyBalancedDefenceIncrement(colony);
    }
  }

  const rebuilt =
    colony.lastRaidedAt === 0 || Date.now() - colony.lastRaidedAt >= NPC_RECOVERY_MS;
  if (rebuilt) {
    colony.currentDefences = { ...colony.baseDefences };
    colony.currentShips = { ...colony.baseShips };
  }
}

export function recordRaid(colony: NPCColony, now: number, gameSpeed: number): void {
  colony.recentRaidTimestamps.push(now);
  if (colony.recentRaidTimestamps.length > 10) {
    colony.recentRaidTimestamps = colony.recentRaidTimestamps.slice(-10);
  }
  colony.raidCount += 1;

  if (colony.raidCount >= 10) {
    colony.currentUpgradeIntervalMs = Math.max(
      colony.initialUpgradeIntervalMs * 0.5,
      colony.currentUpgradeIntervalMs * 0.8,
    );
  }

  if (colony.raidCount >= 15 && colony.specialty !== 'turtle') {
    colony.specialty = 'turtle';
  }

  const abandonment = calcAbandonmentProximity(colony, now, gameSpeed);
  if (
    abandonment.recentRaidCount >= NPC_ABANDONMENT_RAID_THRESHOLD &&
    colony.abandonedAt === undefined
  ) {
    colony.abandonedAt = now;
  }
}

function countRecentRaids(colony: NPCColony, now: number, gameSpeed: number): number {
  const safeGameSpeed = Math.max(0, gameSpeed);
  return colony.recentRaidTimestamps.filter(
    (timestamp) => (now - timestamp) * safeGameSpeed < RAID_WINDOW_MS,
  ).length;
}

function toGameHours(elapsedMs: number, gameSpeed: number): number {
  const safeGameSpeed = Math.max(0, gameSpeed);
  return (elapsedMs * safeGameSpeed) / (3600 * 1000);
}

export function calcAbandonmentProximity(
  colony: NPCColony,
  now: number,
  gameSpeed: number,
): NPCAbandonmentProximity {
  const safeGameSpeed = Math.max(0, gameSpeed);
  const recentRaidCount = countRecentRaids(colony, now, gameSpeed);
  const progressPct = Math.min(
    100,
    Math.round((recentRaidCount / NPC_ABANDONMENT_RAID_THRESHOLD) * 100),
  );
  const status =
    colony.abandonedAt !== undefined || recentRaidCount >= NPC_ABANDONMENT_RAID_THRESHOLD
      ? 'imminent'
      : recentRaidCount === NPC_ABANDONMENT_RAID_THRESHOLD - 1
        ? 'atRisk'
        : 'stable';

  const recentTimestamps = colony.recentRaidTimestamps.filter(
    (timestamp) => (now - timestamp) * safeGameSpeed < RAID_WINDOW_MS,
  );

  const lastRaidTimestamp =
    recentTimestamps.length > 0
      ? Math.max(...recentTimestamps)
      : undefined;
  const oldestRaidTimestamp =
    recentTimestamps.length > 0
      ? Math.min(...recentTimestamps)
      : undefined;
  const lastRaidGameHoursAgo =
    lastRaidTimestamp !== undefined
      ? toGameHours(now - lastRaidTimestamp, safeGameSpeed)
      : undefined;
  const pressureWindowExpiresInGameHours =
    oldestRaidTimestamp !== undefined
      ? Math.max(
          0,
          NPC_ABANDONMENT_WINDOW_GAME_HOURS -
            toGameHours(now - oldestRaidTimestamp, safeGameSpeed),
        )
      : undefined;

  return {
    status,
    recentRaidCount,
    raidThreshold: NPC_ABANDONMENT_RAID_THRESHOLD,
    progressPct,
    windowGameHours: NPC_ABANDONMENT_WINDOW_GAME_HOURS,
    lastRaidGameHoursAgo,
    pressureWindowExpiresInGameHours,
  };
}

export function processUpgrades(state: GameState, now: number): void {
  const safeGameSpeed = Math.max(0, state.settings.gameSpeed);

  for (let index = 0; index < state.galaxy.npcColonies.length; ) {
    const colony = state.galaxy.npcColonies[index];

    if (
      colony.abandonedAt !== undefined &&
      (now - colony.abandonedAt) * safeGameSpeed >= NPC_RECOVERY_MS
    ) {
      const targetCoords = colony.coordinates;
      state.galaxy.npcColonies.splice(index, 1);

      for (const mission of state.fleetMissions) {
        if (
          (mission.status === 'outbound' || mission.status === 'returning') &&
          sameCoords(mission.targetCoordinates, targetCoords)
        ) {
          mission.status = 'returning';
          mission.returnTime = now + SAFE_RETURN_MS;
        }
      }
      continue;
    }

    if (safeGameSpeed > 0) {
      const maxCatchupLagMs = MAX_CATCHUP_REAL_MS / safeGameSpeed;
      if (now - colony.lastUpgradeAt > maxCatchupLagMs) {
        colony.lastUpgradeAt = now - maxCatchupLagMs;
      }
    }

    let upgradeIterations = 0;
    while (
      colony.abandonedAt === undefined &&
      safeGameSpeed > 0 &&
      (now - colony.lastUpgradeAt) * safeGameSpeed >= colony.currentUpgradeIntervalMs &&
      upgradeIterations < MAX_UPGRADE_ITERATIONS
    ) {
      const rng = mulberry32(
        state.galaxy.seed ^
          (colony.coordinates.system * 100 + colony.coordinates.slot) ^
          colony.upgradeTickCount,
      );
      applyUpgradeIncrement(colony, rng);
      colony.lastUpgradeAt += colony.currentUpgradeIntervalMs / safeGameSpeed;
      colony.upgradeTickCount += 1;
      upgradeIterations += 1;
    }

    index += 1;
  }
}
