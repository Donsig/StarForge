import { SHIPS, type CombatShipId, type ShipDrive } from '../data/ships.ts';
import { addDebris, getNPCCurrentForce, getNPCResources } from './GalaxyEngine.ts';
import { simulate } from './CombatEngine.ts';
import { generateReport } from './EspionageEngine.ts';
import { getStorageCaps } from './ResourceEngine.ts';
import type { GameState } from '../models/GameState.ts';
import type { CombatResult } from '../models/Combat.ts';
import type { FleetMission, MissionType } from '../models/Fleet.ts';
import type { Coordinates } from '../models/Galaxy.ts';
import type { ShipId } from '../models/types.ts';

const COMPLETED_MISSION_RETENTION_MS = 7 * 24 * 3600 * 1000;
const ESPIONAGE_MAX_TRAVEL_SECONDS = 10;
const ESPIONAGE_MIN_FUEL_COST = 1;
const UPGRADE_SPEED_BY_SHIP: Partial<Record<CombatShipId, number>> = {
  smallCargo: 10000,
  bomber: 5000,
};

type MissionShips = Record<string, number>;

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

function driveResearchLevel(research: GameState['research'], drive: ShipDrive): number {
  if (drive === 'combustion') return research.combustionDrive;
  if (drive === 'impulse') return research.impulseDrive;
  return research.hyperspaceDrive;
}

function driveBonus(research: GameState['research'], drive: ShipDrive): number {
  if (drive === 'combustion') return 1 + 0.1 * research.combustionDrive;
  if (drive === 'impulse') return 1 + 0.2 * research.impulseDrive;
  return 1 + 0.3 * research.hyperspaceDrive;
}

function compactShips(ships: Partial<Record<string, number>>): MissionShips {
  const compacted: MissionShips = {};
  for (const [shipId, value] of Object.entries(ships)) {
    const count = Math.max(0, Math.floor(value ?? 0));
    if (count > 0) {
      compacted[shipId] = count;
    }
  }
  return compacted;
}

function isMatchingCoordinates(a: Coordinates, b: Coordinates): boolean {
  return a.galaxy === b.galaxy && a.system === b.system && a.slot === b.slot;
}

function missionCompletedAt(mission: FleetMission): number {
  if (mission.returnTime > 0) return mission.returnTime;
  return mission.arrivalTime > 0 ? mission.arrivalTime : mission.departureTime;
}

function calcMissionTravelSeconds(
  missionType: MissionType,
  distance: number,
  fleetSpeed: number,
  gameSpeed: number,
): number {
  const travelSeconds = calcTravelSeconds(distance, fleetSpeed, gameSpeed);
  if (missionType === 'espionage') {
    return Math.min(travelSeconds, ESPIONAGE_MAX_TRAVEL_SECONDS);
  }
  return travelSeconds;
}

function calcMissionReturnTravelMs(
  state: GameState,
  mission: FleetMission,
): number {
  const sourcePlanet = state.planets[mission.sourcePlanetIndex];
  if (!sourcePlanet) return 0;

  const distance = calcDistance(sourcePlanet.coordinates, mission.targetCoordinates);
  const returnSpeed = calcFleetSpeed(mission.ships, state.research);
  const travelSeconds =
    returnSpeed > 0
      ? calcMissionTravelSeconds(
          mission.type,
          distance,
          returnSpeed,
          state.settings.gameSpeed,
        )
      : 0;
  return travelSeconds * 1000;
}

function effectiveShipDriveAndSpeed(
  shipId: string,
  research: GameState['research'],
): { drive: ShipDrive; speed: number } | null {
  const ship = SHIPS[shipId as CombatShipId];
  if (!ship) return null;

  let drive: ShipDrive = ship.drive;
  let speed = ship.speed;

  if (ship.driveUpgrade) {
    const upgradeLevel = driveResearchLevel(research, ship.driveUpgrade.drive);
    if (upgradeLevel >= ship.driveUpgrade.atLevel) {
      drive = ship.driveUpgrade.drive;
      speed = UPGRADE_SPEED_BY_SHIP[ship.id] ?? ship.speed;
    }
  }

  return { drive, speed };
}

function nextMissionId(state: GameState, now: number): string {
  const nowHex = (now >>> 0).toString(16).padStart(8, '0');
  const seqHex = (state.fleetMissions.length & 0xffff).toString(16).padStart(4, '0');
  return `mission_${nowHex}${seqHex}`;
}

function nextCombatLogId(now: number, missionId: string): string {
  const nowHex = (now >>> 0).toString(16).padStart(8, '0');
  return `combat_${nowHex}_${missionId.slice(-8)}`;
}

function applyNpcLosses(
  base: Record<string, number>,
  end: Partial<Record<string, number>> | undefined,
): Record<string, number> {
  const updated: Record<string, number> = {};
  for (const id of Object.keys(base)) {
    updated[id] = Math.max(0, Math.floor(end?.[id] ?? 0));
  }
  return updated;
}

function resolveAttackAtTarget(state: GameState, mission: FleetMission, now: number): void {
  const colony = state.galaxy.npcColonies.find((npc) =>
    isMatchingCoordinates(npc.coordinates, mission.targetCoordinates));

  if (!colony) {
    mission.ships = {};
    mission.cargo = { metal: 0, crystal: 0, deuterium: 0 };
    mission.returnTime = now + calcMissionReturnTravelMs(state, mission);
    mission.status = 'returning';
    return;
  }

  const npcResources = getNPCResources(colony, now);
  const npcForce = getNPCCurrentForce(colony, now);
  const seed = (now ^ Number.parseInt(mission.id.slice(-8), 16)) >>> 0;

  const combatResult = simulate(
    {
      ships: mission.ships,
      techs: {
        weaponsTechnology: state.research.weaponsTechnology,
        shieldingTechnology: state.research.shieldingTechnology,
        armourTechnology: state.research.armourTechnology,
      },
    },
    {
      ships: npcForce.ships,
      defences: npcForce.defences,
      techs: {
        weaponsTechnology: 0,
        shieldingTechnology: 0,
        armourTechnology: 0,
      },
    },
    seed,
  );

  const survivingShips = compactShips(combatResult.attackerEnd.ships);
  const loot = calcLoot(npcResources, survivingShips);
  const resultWithLoot: CombatResult = {
    ...combatResult,
    loot,
  };

  colony.currentDefences = applyNpcLosses(
    colony.baseDefences,
    resultWithLoot.defenderEnd.defences,
  );
  colony.currentShips = applyNpcLosses(colony.baseShips, resultWithLoot.defenderEnd.ships);
  colony.lastRaidedAt = now;

  mission.ships = survivingShips;
  mission.cargo = loot;

  addDebris(
    state,
    mission.targetCoordinates,
    resultWithLoot.debrisCreated.metal,
    resultWithLoot.debrisCreated.crystal,
  );

  const combatLogId = nextCombatLogId(now, mission.id);
  state.combatLog.push({
    id: combatLogId,
    timestamp: now,
    targetCoordinates: { ...mission.targetCoordinates },
    result: resultWithLoot,
    read: false,
  });
  mission.combatResultId = combatLogId;
  mission.returnTime = now + calcMissionReturnTravelMs(state, mission);
  mission.status = 'returning';
}

function resolveEspionageAtTarget(
  state: GameState,
  mission: FleetMission,
  now: number,
): void {
  const colony = state.galaxy.npcColonies.find((npc) =>
    isMatchingCoordinates(npc.coordinates, mission.targetCoordinates));
  const probeCount = Math.max(0, Math.floor(mission.ships.espionageProbe ?? 0));

  if (!colony || probeCount <= 0) {
    mission.status = 'completed';
    return;
  }

  const seed = (now ^ Number.parseInt(mission.id.slice(-8), 16)) >>> 0;
  const rng = mulberry32(seed);
  const report = generateReport(
    colony,
    now,
    mission.sourcePlanetIndex,
    probeCount,
    state.research,
    rng,
  );

  state.espionageReports.push(report);
  mission.espionageReportId = report.id;

  if (report.detected) {
    mission.status = 'completed';
    mission.returnTime = now;
    return;
  }

  mission.returnTime = now + calcMissionReturnTravelMs(state, mission);
  mission.status = 'returning';
}

function resolveAtTarget(state: GameState, mission: FleetMission, now: number): void {
  if (mission.type === 'espionage') {
    resolveEspionageAtTarget(state, mission, now);
    return;
  }
  resolveAttackAtTarget(state, mission, now);
}

function resolveReturn(state: GameState, mission: FleetMission): void {
  const sourcePlanet = state.planets[mission.sourcePlanetIndex];
  if (!sourcePlanet) {
    mission.status = 'completed';
    return;
  }

  const caps = getStorageCaps(sourcePlanet);
  sourcePlanet.resources.metal = Math.min(
    caps.metal,
    sourcePlanet.resources.metal + mission.cargo.metal,
  );
  sourcePlanet.resources.crystal = Math.min(
    caps.crystal,
    sourcePlanet.resources.crystal + mission.cargo.crystal,
  );
  sourcePlanet.resources.deuterium = Math.min(
    caps.deuterium,
    sourcePlanet.resources.deuterium + mission.cargo.deuterium,
  );

  for (const [shipId, countValue] of Object.entries(mission.ships)) {
    const count = Math.max(0, Math.floor(countValue));
    if (count <= 0) continue;
    if (sourcePlanet.ships[shipId as ShipId] === undefined) continue;
    sourcePlanet.ships[shipId as ShipId] += count;
  }

  mission.status = 'completed';
}

export function resolveMissionArrival(
  state: GameState,
  mission: FleetMission,
  now: number = Date.now(),
): void {
  if (mission.status !== 'outbound' && mission.status !== 'at_target') {
    return;
  }
  mission.status = 'at_target';
  resolveAtTarget(state, mission, now);
}

export function resolveMissionReturn(state: GameState, mission: FleetMission): void {
  if (mission.status !== 'returning') {
    return;
  }
  resolveReturn(state, mission);
}

export function resolveMissionToCompletion(
  state: GameState,
  mission: FleetMission,
  now: number = Date.now(),
): void {
  if (mission.status === 'completed') {
    return;
  }

  if (mission.status === 'outbound' || mission.status === 'at_target') {
    resolveMissionArrival(state, mission, now);
  }

  if (mission.status === 'returning') {
    resolveMissionReturn(state, mission);
  }
}

export function calcDistance(a: Coordinates, b: Coordinates): number {
  if (a.system === b.system) {
    return 1000 + 5 * Math.abs(a.slot - b.slot);
  }
  return 2700 + 95 * Math.abs(a.system - b.system);
}

export function calcFleetSpeed(
  ships: MissionShips,
  research: GameState['research'],
): number {
  let minSpeed = Number.POSITIVE_INFINITY;
  for (const [shipId, countValue] of Object.entries(ships)) {
    const count = Math.max(0, Math.floor(countValue));
    if (count <= 0) continue;

    const effective = effectiveShipDriveAndSpeed(shipId, research);
    if (!effective) continue;

    const speed = effective.speed * driveBonus(research, effective.drive);
    minSpeed = Math.min(minSpeed, speed);
  }

  return Number.isFinite(minSpeed) ? minSpeed : 0;
}

export function calcTravelSeconds(
  distance: number,
  fleetSpeed: number,
  gameSpeed: number,
): number {
  if (distance <= 0 || fleetSpeed <= 0 || gameSpeed <= 0) return 0;
  return 10 + (3500 / gameSpeed) * Math.sqrt((distance * 10) / fleetSpeed);
}

export function calcFuelCost(ships: MissionShips, distance: number): number {
  const distanceFactor = 1 + distance / 35000;
  let fuel = 0;
  for (const [shipId, countValue] of Object.entries(ships)) {
    const count = Math.max(0, Math.floor(countValue));
    if (count <= 0) continue;

    const ship = SHIPS[shipId as CombatShipId];
    if (!ship) continue;

    fuel += ship.fuelConsumption * count * distanceFactor;
  }

  return Math.ceil(fuel);
}

export function calcMaxFleetSlots(research: GameState['research']): number {
  return 1 + research.computerTechnology;
}

export function calcCargoCapacity(ships: MissionShips): number {
  let capacity = 0;
  for (const [shipId, countValue] of Object.entries(ships)) {
    const count = Math.max(0, Math.floor(countValue));
    if (count <= 0) continue;

    const ship = SHIPS[shipId as CombatShipId];
    if (!ship) continue;

    capacity += ship.cargoCapacity * count;
  }
  return capacity;
}

export function calcLoot(
  npcResources: { metal: number; crystal: number; deuterium: number },
  survivingShips: MissionShips,
): { metal: number; crystal: number; deuterium: number } {
  const available = {
    metal: Math.max(0, Math.floor(npcResources.metal * 0.5)),
    crystal: Math.max(0, Math.floor(npcResources.crystal * 0.5)),
    deuterium: Math.max(0, Math.floor(npcResources.deuterium * 0.5)),
  };

  const capacity = Math.max(0, Math.floor(calcCargoCapacity(survivingShips)));
  const totalAvailable = available.metal + available.crystal + available.deuterium;

  if (totalAvailable <= capacity) {
    return available;
  }

  let remaining = capacity;
  const metal = Math.min(available.metal, remaining);
  remaining -= metal;
  const crystal = Math.min(available.crystal, remaining);
  remaining -= crystal;
  const deuterium = Math.min(available.deuterium, remaining);

  return { metal, crystal, deuterium };
}

export function dispatch(
  state: GameState,
  sourcePlanetIndex: number,
  targetCoords: Coordinates,
  ships: MissionShips,
  missionType: MissionType = 'attack',
): FleetMission | null {
  const sourcePlanet = state.planets[sourcePlanetIndex];
  if (!sourcePlanet) return null;

  const activeMissions = state.fleetMissions.filter(
    (mission) => mission.status !== 'completed',
  ).length;
  if (activeMissions >= calcMaxFleetSlots(state.research)) {
    return null;
  }

  const selectedShips: MissionShips = {};
  for (const [shipId, requestedValue] of Object.entries(ships)) {
    const requested = Math.max(0, Math.floor(requestedValue));
    if (requested <= 0) continue;
    if (missionType === 'espionage' && shipId !== 'espionageProbe') return null;
    if (sourcePlanet.ships[shipId as ShipId] === undefined) continue;
    if (sourcePlanet.ships[shipId as ShipId] < requested) return null;
    selectedShips[shipId] = requested;
  }

  if (missionType === 'espionage') {
    const selectedShipIds = Object.keys(selectedShips);
    if (
      selectedShipIds.length !== 1 ||
      selectedShipIds[0] !== 'espionageProbe'
    ) {
      return null;
    }
    if ((selectedShips.espionageProbe ?? 0) <= 0) {
      return null;
    }
  } else if (Object.keys(selectedShips).length === 0) {
    return null;
  }

  const distance = calcDistance(sourcePlanet.coordinates, targetCoords);
  const fleetSpeed = calcFleetSpeed(selectedShips, state.research);
  if (fleetSpeed <= 0) return null;

  const fuelCost =
    missionType === 'espionage'
      ? ESPIONAGE_MIN_FUEL_COST
      : calcFuelCost(selectedShips, distance);
  if (sourcePlanet.resources.deuterium < fuelCost) {
    return null;
  }

  for (const [shipId, countValue] of Object.entries(selectedShips)) {
    const count = Math.max(0, Math.floor(countValue));
    sourcePlanet.ships[shipId as ShipId] -= count;
  }
  sourcePlanet.resources.deuterium -= fuelCost;

  const now = Date.now();
  const travelSeconds = calcMissionTravelSeconds(
    missionType,
    distance,
    fleetSpeed,
    state.settings.gameSpeed,
  );

  const mission: FleetMission = {
    id: nextMissionId(state, now),
    type: missionType,
    status: 'outbound',
    sourcePlanetIndex,
    targetCoordinates: { ...targetCoords },
    targetType: 'npc_colony',
    ships: { ...selectedShips },
    cargo: { metal: 0, crystal: 0, deuterium: 0 },
    fuelCost,
    departureTime: now,
    arrivalTime: now + travelSeconds * 1000,
    returnTime: 0,
  };

  state.fleetMissions.push(mission);
  return mission;
}

export function recallMission(state: GameState, missionId: string): void {
  const mission = state.fleetMissions.find((item) => item.id === missionId);
  if (!mission || mission.status !== 'outbound') return;

  const now = Date.now();
  const elapsed = Math.max(0, now - mission.departureTime);

  mission.status = 'returning';
  mission.arrivalTime = now;
  mission.returnTime = now + elapsed;
  mission.cargo = { metal: 0, crystal: 0, deuterium: 0 };
}

export function rescaleMissionETAs(
  state: GameState,
  oldSpeed: number,
  newSpeed: number,
  now: number = Date.now(),
): void {
  if (oldSpeed === newSpeed || oldSpeed <= 0 || newSpeed <= 0) return;

  const ratio = oldSpeed / newSpeed;
  for (const mission of state.fleetMissions) {
    if (mission.status === 'outbound') {
      const remaining = mission.arrivalTime - now;
      if (remaining > 0) {
        mission.arrivalTime = now + remaining * ratio;
      }
      continue;
    }

    if (mission.status === 'returning' && mission.returnTime > 0) {
      const remaining = mission.returnTime - now;
      if (remaining > 0) {
        mission.returnTime = now + remaining * ratio;
      }
    }
  }
}

export function processTick(state: GameState, now: number = Date.now()): void {
  for (const mission of state.fleetMissions) {
    if (mission.status === 'outbound' && now >= mission.arrivalTime) {
      resolveMissionArrival(state, mission, now);
    } else if (
      mission.status === 'returning' &&
      mission.returnTime > 0 &&
      now >= mission.returnTime
    ) {
      resolveMissionReturn(state, mission);
    }
  }

  const pruneBefore = now - COMPLETED_MISSION_RETENTION_MS;
  state.fleetMissions = state.fleetMissions.filter(
    (mission) =>
      mission.status !== 'completed' || missionCompletedAt(mission) >= pruneBefore,
  );
}
