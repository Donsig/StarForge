import type { GameState } from '../models/GameState.ts';
import type {
  Coordinates,
  NPCAbandonmentProximity,
  NPCColony,
} from '../models/Galaxy.ts';
import type { BuildingId, DefenceId, ResourceCost, ShipId } from '../models/types.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { SHIPS } from '../data/ships.ts';
import { buildingCostAtLevel } from './FormulasEngine.ts';

const NPC_RECOVERY_MS = 48 * 3600 * 1000;
const RAID_WINDOW_MS = 24 * 3600 * 1000;
const SAFE_RETURN_MS = 30_000;
const MAX_CATCHUP_REAL_MS = 7 * 24 * 3600 * 1000;
const MAX_UPGRADE_ITERATIONS = 500;
const TIER_POWER_THRESHOLD = 500;
const CATCH_UP_TICKS_PER_TIER = 5;

export const NPC_ABANDONMENT_RAID_THRESHOLD = 3;
export const NPC_ABANDONMENT_WINDOW_GAME_HOURS = 24;

export function computeEffectiveMinTier(playerTotal: number): number {
  return Math.max(1, Math.min(10, Math.floor(playerTotal / TIER_POWER_THRESHOLD)));
}

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

type ResourceBalance = NPCColony['resources'];
type UpgradeAction = {
  canAfford: (colony: NPCColony) => boolean;
  apply: (colony: NPCColony) => boolean;
};

function canAfford(resources: ResourceBalance, cost: ResourceCost): boolean {
  return (
    resources.metal >= cost.metal &&
    resources.crystal >= cost.crystal &&
    resources.deuterium >= cost.deuterium
  );
}

function debit(resources: ResourceBalance, cost: ResourceCost): void {
  resources.metal -= cost.metal;
  resources.crystal -= cost.crystal;
  resources.deuterium -= cost.deuterium;
}

function tryAddShip(colony: NPCColony, shipId: ShipId, amount: number): boolean {
  const unitCost = SHIPS[shipId].cost;
  const totalCost = {
    metal: unitCost.metal * amount,
    crystal: unitCost.crystal * amount,
    deuterium: unitCost.deuterium * amount,
  };
  if (!canAfford(colony.resources, totalCost)) {
    return false;
  }

  debit(colony.resources, totalCost);
  colony.baseShips[shipId] = (colony.baseShips[shipId] ?? 0) + amount;
  return true;
}

function tryAddDefence(colony: NPCColony, defenceId: DefenceId, amount: number): boolean {
  const unitCost = DEFENCES[defenceId].cost;
  const totalCost = {
    metal: unitCost.metal * amount,
    crystal: unitCost.crystal * amount,
    deuterium: unitCost.deuterium * amount,
  };
  if (!canAfford(colony.resources, totalCost)) {
    return false;
  }

  debit(colony.resources, totalCost);
  colony.baseDefences[defenceId] = (colony.baseDefences[defenceId] ?? 0) + amount;
  return true;
}

function tryUpgradeBuilding(
  colony: NPCColony,
  buildingId: BuildingId,
  maxLevel: number,
): boolean {
  const current = Math.max(0, Math.floor(colony.buildings[buildingId] ?? 0));
  if (current >= maxLevel) {
    return false;
  }

  const definition = BUILDINGS[buildingId];
  const targetLevel = current + 1;
  const cost = buildingCostAtLevel(
    definition.baseCost,
    definition.costMultiplier,
    targetLevel,
  );
  if (!canAfford(colony.resources, cost)) {
    return false;
  }

  debit(colony.resources, cost);
  colony.buildings[buildingId] = Math.min(maxLevel, targetLevel);
  return true;
}

function shipAction(shipId: ShipId, amount: number): UpgradeAction {
  const unitCost = SHIPS[shipId].cost;
  const totalCost = {
    metal: unitCost.metal * amount,
    crystal: unitCost.crystal * amount,
    deuterium: unitCost.deuterium * amount,
  };
  return {
    canAfford: (colony) => canAfford(colony.resources, totalCost),
    apply: (colony) => tryAddShip(colony, shipId, amount),
  };
}

function defenceAction(defenceId: DefenceId, amount: number): UpgradeAction {
  const unitCost = DEFENCES[defenceId].cost;
  const totalCost = {
    metal: unitCost.metal * amount,
    crystal: unitCost.crystal * amount,
    deuterium: unitCost.deuterium * amount,
  };
  return {
    canAfford: (colony) => canAfford(colony.resources, totalCost),
    apply: (colony) => tryAddDefence(colony, defenceId, amount),
  };
}

function buildingAction(buildingId: BuildingId, maxLevel: number): UpgradeAction {
  return {
    canAfford: (colony) => {
      const current = Math.max(0, Math.floor(colony.buildings[buildingId] ?? 0));
      if (current >= maxLevel) {
        return false;
      }
      const definition = BUILDINGS[buildingId];
      const cost = buildingCostAtLevel(
        definition.baseCost,
        definition.costMultiplier,
        current + 1,
      );
      return canAfford(colony.resources, cost);
    },
    apply: (colony) => tryUpgradeBuilding(colony, buildingId, maxLevel),
  };
}

function runPriorityActions(colony: NPCColony, actions: UpgradeAction[], rng: () => number): void {
  if (actions.length === 0) {
    return;
  }
  if (rng() < 0.1) {
    return;
  }

  for (const action of actions) {
    if (!action.canAfford(colony)) {
      continue;
    }
    if (action.apply(colony)) {
      return;
    }
  }
}

function turtleActions(colony: NPCColony, phase: number, maxBuildingLevel: number): UpgradeAction[] {
  const defencePriority =
    colony.tier <= 4
      ? [defenceAction('rocketLauncher', 5), defenceAction('lightLaser', 3)]
      : colony.tier <= 6
        ? [
            defenceAction('heavyLaser', 2),
            defenceAction('lightLaser', 3),
            defenceAction('rocketLauncher', 5),
          ]
        : [
            defenceAction('plasmaTurret', 1),
            defenceAction('heavyLaser', 2),
            defenceAction('lightLaser', 3),
            defenceAction('rocketLauncher', 5),
          ];

  if (phase % 3 === 2) {
    return [buildingAction('metalMine', maxBuildingLevel), ...defencePriority];
  }

  return [...defencePriority, buildingAction('metalMine', maxBuildingLevel)];
}

function fleeterActions(colony: NPCColony, phase: number, maxBuildingLevel: number): UpgradeAction[] {
  const fleetPriority =
    colony.tier <= 4
      ? [
          shipAction('lightFighter', 3),
          shipAction('heavyFighter', 2),
          shipAction('smallCargo', 2),
        ]
      : colony.tier <= 6
        ? [
            shipAction('cruiser', 2),
            shipAction('heavyFighter', 2),
            shipAction('lightFighter', 3),
          ]
        : [
            shipAction('battleship', 1),
            shipAction('cruiser', 1),
            shipAction('heavyFighter', 2),
            shipAction('lightFighter', 3),
          ];

  const step = phase % 4;
  if (step === 2) {
    return [buildingAction('metalMine', maxBuildingLevel), ...fleetPriority];
  }
  if (step === 3) {
    return [buildingAction('crystalMine', maxBuildingLevel), ...fleetPriority];
  }
  return [...fleetPriority, buildingAction('metalMine', maxBuildingLevel)];
}

function minerActions(colony: NPCColony, phase: number, maxBuildingLevel: number): UpgradeAction[] {
  const satelliteAmount = Math.max(1, Math.floor(colony.tier / 2));
  const step = phase % 3;
  if (step === 0) {
    return [
      buildingAction('metalMine', maxBuildingLevel),
      buildingAction('crystalMine', maxBuildingLevel),
      buildingAction('deuteriumSynthesizer', maxBuildingLevel),
    ];
  }
  if (step === 1) {
    return [
      buildingAction('crystalMine', maxBuildingLevel),
      buildingAction('metalMine', maxBuildingLevel),
      buildingAction('deuteriumSynthesizer', maxBuildingLevel),
    ];
  }
  return [
    shipAction('solarSatellite', satelliteAmount),
    buildingAction('deuteriumSynthesizer', maxBuildingLevel),
    buildingAction('metalMine', maxBuildingLevel),
  ];
}

function balancedActions(colony: NPCColony, phase: number, maxBuildingLevel: number): UpgradeAction[] {
  const fleetPriority =
    colony.tier >= 5
      ? [shipAction('cruiser', 1), shipAction('lightFighter', 3)]
      : [shipAction('lightFighter', 3), shipAction('smallCargo', 2)];
  const defencePriority =
    colony.tier >= 6
      ? [defenceAction('ionCannon', 1), defenceAction('lightLaser', 3), defenceAction('rocketLauncher', 5)]
      : [defenceAction('rocketLauncher', 5), defenceAction('lightLaser', 3)];
  const step = phase % 4;

  if (step === 0) {
    return [
      buildingAction('metalMine', maxBuildingLevel),
      ...fleetPriority,
      ...defencePriority,
    ];
  }
  if (step === 1) {
    return [
      ...fleetPriority,
      ...defencePriority,
      buildingAction('metalMine', maxBuildingLevel),
    ];
  }
  if (step === 2) {
    return [
      ...defencePriority,
      ...fleetPriority,
      buildingAction('metalMine', maxBuildingLevel),
    ];
  }
  return [
    buildingAction('crystalMine', maxBuildingLevel),
    ...fleetPriority,
    ...defencePriority,
  ];
}

function raiderActions(colony: NPCColony, phase: number, maxBuildingLevel: number): UpgradeAction[] {
  const fleetPriority =
    colony.tier <= 4
      ? [
          shipAction('lightFighter', 4),
          shipAction('smallCargo', 2),
        ]
      : colony.tier <= 6
        ? [
            shipAction('cruiser', 3),
            shipAction('lightFighter', 3),
            shipAction('smallCargo', 2),
          ]
        : [
            shipAction('battlecruiser', 2),
            shipAction('cruiser', 1),
            shipAction('lightFighter', 3),
            shipAction('smallCargo', 2),
          ];

  if (phase % 3 === 2) {
    return [
      defenceAction('rocketLauncher', 2),
      ...fleetPriority,
      buildingAction('shipyard', maxBuildingLevel),
    ];
  }

  return [...fleetPriority, buildingAction('shipyard', maxBuildingLevel)];
}

function researcherActions(colony: NPCColony, phase: number, maxBuildingLevel: number): UpgradeAction[] {
  if (phase % 5 === 4) {
    return [
      buildingAction('researchLab', colony.tier * 2),
      buildingAction('crystalMine', maxBuildingLevel),
      buildingAction('metalMine', maxBuildingLevel),
    ];
  }

  return [
    buildingAction('crystalMine', maxBuildingLevel),
    buildingAction('metalMine', maxBuildingLevel),
    buildingAction('researchLab', colony.tier * 2),
  ];
}

export function applyUpgradeIncrement(colony: NPCColony, rng: () => number): void {
  if (colony.abandonedAt !== undefined) {
    return;
  }

  const maxBuildingLevel = colony.maxTier * 2;
  const phase = colony.upgradeTickCount;

  let actions: UpgradeAction[] = [];
  if (colony.specialty === 'turtle') {
    actions = turtleActions(colony, phase, maxBuildingLevel);
  } else if (colony.specialty === 'fleeter') {
    actions = fleeterActions(colony, phase, maxBuildingLevel);
  } else if (colony.specialty === 'miner') {
    actions = minerActions(colony, phase, maxBuildingLevel);
  } else if (colony.specialty === 'balanced') {
    actions = balancedActions(colony, phase, maxBuildingLevel);
  } else if (colony.specialty === 'raider') {
    actions = raiderActions(colony, phase, maxBuildingLevel);
  } else if (colony.specialty === 'researcher') {
    actions = researcherActions(colony, phase, maxBuildingLevel);
  }

  runPriorityActions(colony, actions, rng);

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

export function processUpgrades(state: GameState, now: number, playerTotal: number): void {
  const safeGameSpeed = Math.max(0, state.settings.gameSpeed);
  const effectiveMin = computeEffectiveMinTier(playerTotal);

  for (const colony of state.galaxy.npcColonies) {
    if (effectiveMin > colony.targetTier && colony.targetTier < colony.maxTier) {
      colony.targetTier = Math.min(colony.maxTier, effectiveMin);
    }
  }

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
      upgradeIterations < MAX_UPGRADE_ITERATIONS
    ) {
      const isCatchingUp = colony.tier < colony.targetTier;
      const activeInterval = isCatchingUp
        ? colony.catchUpUpgradeIntervalMs
        : colony.currentUpgradeIntervalMs;

      if ((now - colony.lastUpgradeAt) * safeGameSpeed < activeInterval) {
        break;
      }

      const rng = mulberry32(
        state.galaxy.seed ^
          (colony.coordinates.system * 100 + colony.coordinates.slot) ^
          colony.upgradeTickCount,
      );
      applyUpgradeIncrement(colony, rng);
      colony.lastUpgradeAt += activeInterval / safeGameSpeed;
      colony.upgradeTickCount += 1;
      if (isCatchingUp) {
        colony.catchUpProgressTicks += 1;
        if (colony.catchUpProgressTicks % CATCH_UP_TICKS_PER_TIER === 0) {
          colony.tier = Math.min(colony.targetTier, colony.tier + 1);
          if (colony.tier >= colony.targetTier) {
            colony.catchUpProgressTicks = 0;
          }
        }
      }
      upgradeIterations += 1;
    }

    index += 1;
  }
}
