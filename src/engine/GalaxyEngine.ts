import type { GameState } from '../models/GameState.ts';
import type { Coordinates, NPCColony, NPCSpecialty } from '../models/Galaxy.ts';
import type { PlanetState } from '../models/Planet.ts';
import { createDefaultPlanet } from '../models/Planet.ts';
import { GALAXY_CONSTANTS } from '../data/galaxy.ts';
import { calculateProduction } from './ResourceEngine.ts';
import { activePlanet } from './helpers.ts';

const NPC_RECOVERY_MS = 48 * 3600 * 1000;
const NPC_RESOURCE_CAP_HOURS = 48;

const NPC_NAME_PREFIXES = [
  'Zorgon',
  'Kelvar',
  'Nexar',
  'Thorian',
  'Vexar',
  'Drakar',
  'Solmar',
  'Cyphran',
  'Moldar',
  'Xenthar',
];
const NPC_SPECIALTIES: NPCSpecialty[] = [
  'turtle',
  'fleeter',
  'miner',
  'balanced',
  'raider',
  'researcher',
];

const NPC_RESEARCH_LEVELS: GameState['research'] = {
  energyTechnology: 0,
  laserTechnology: 0,
  ionTechnology: 0,
  plasmaTechnology: 0,
  espionageTechnology: 0,
  computerTechnology: 0,
  weaponsTechnology: 0,
  shieldingTechnology: 0,
  armourTechnology: 0,
  combustionDrive: 0,
  impulseDrive: 0,
  hyperspaceDrive: 0,
  hyperspaceTechnology: 0,
  astrophysicsTechnology: 0,
};

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

const SLOT_TEMPERATURE_RANGES: { slots: [number, number]; min: number; max: number }[] = [
  { slots: [1, 3], min: 200, max: 400 },
  { slots: [4, 6], min: 100, max: 200 },
  { slots: [7, 9], min: 0, max: 100 },
  { slots: [10, 12], min: -50, max: 0 },
  { slots: [13, 15], min: -100, max: -50 },
];

const SLOT_FIELD_RANGES: { slots: [number, number]; min: number; max: number }[] = [
  { slots: [1, 3], min: 40, max: 70 },
  { slots: [4, 6], min: 90, max: 130 },
  { slots: [7, 9], min: 140, max: 180 },
  { slots: [10, 12], min: 120, max: 160 },
  { slots: [13, 15], min: 80, max: 120 },
];

export function slotTemperatureRange(slot: number): { min: number; max: number } {
  const range =
    SLOT_TEMPERATURE_RANGES.find((r) => slot >= r.slots[0] && slot <= r.slots[1]) ??
    { slots: [0, 0], min: 0, max: 100 };
  return { min: range.min, max: range.max };
}

export function slotFieldRange(slot: number): { min: number; max: number } {
  const range =
    SLOT_FIELD_RANGES.find((r) => slot >= r.slots[0] && slot <= r.slots[1]) ??
    { slots: [0, 0], min: 140, max: 180 };
  return { min: range.min, max: range.max };
}

export function planetStatsForSlot(
  seed: number,
  coordinates: Coordinates,
): { maxTemperature: number; maxFields: number } {
  const rng = mulberry32(seed ^ (coordinates.system * 1000 + coordinates.slot * 17));
  const tempRange = slotTemperatureRange(coordinates.slot);
  const fieldRange = slotFieldRange(coordinates.slot);
  const maxTemperature = Math.round(tempRange.min + rng() * (tempRange.max - tempRange.min));
  const maxFields = Math.round(fieldRange.min + rng() * (fieldRange.max - fieldRange.min));
  return { maxTemperature, maxFields };
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeTier(tier: number): number {
  return clamp(1, Math.floor(tier), 10);
}

function maxTierForNPC(tier: number): number {
  if (tier <= 3) return 5;
  if (tier <= 6) return 8;
  return 10;
}

function initialUpgradeIntervalMsForTier(tier: number): number {
  if (tier <= 3) return 21_600_000;
  if (tier <= 6) return 10_800_000;
  return 5_400_000;
}

function specialtyForCoordinates(seed: number, coordinates: Coordinates): NPCSpecialty {
  const rng = mulberry32(seed ^ (coordinates.system * 100 + coordinates.slot));
  return NPC_SPECIALTIES[Math.floor(rng() * NPC_SPECIALTIES.length)] ?? 'balanced';
}

function nameForNPC(seed: number, coordinates: Coordinates): string {
  const coordSeed =
    seed ^
    (coordinates.galaxy * 100_000 + coordinates.system * 100 + coordinates.slot);
  const rng = mulberry32(coordSeed);
  const prefix = NPC_NAME_PREFIXES[Math.floor(rng() * NPC_NAME_PREFIXES.length)] ?? 'Zorgon';
  return `${prefix} Colony`;
}

export function buildNPCBuildingsForTier(tier: number): Record<string, number> {
  const safeTier = sanitizeTier(tier);
  return {
    metalMine: safeTier * 2,
    crystalMine: Math.floor(safeTier * 1.5),
    deuteriumSynthesizer: Math.floor(safeTier * 1.2),
    solarPlant: safeTier * 2 + 2,
    fusionReactor: 0,
    metalStorage: Math.max(0, safeTier - 2),
    crystalStorage: Math.max(0, safeTier - 2),
    deuteriumTank: Math.max(0, safeTier - 3),
    roboticsFactory: Math.max(0, safeTier - 3),
    naniteFactory: 0,
    shipyard: Math.max(0, safeTier - 2),
    researchLab: Math.max(0, safeTier - 4),
  };
}

export function buildNPCDefencesForTier(tier: number): Record<string, number> {
  const safeTier = sanitizeTier(tier);
  const defences: Record<string, number> = {
    rocketLauncher: 0,
    lightLaser: 0,
    heavyLaser: 0,
    gaussCannon: 0,
    ionCannon: 0,
    plasmaTurret: 0,
    smallShieldDome: 0,
    largeShieldDome: 0,
  };

  if (safeTier <= 2) {
    defences.rocketLauncher = safeTier * 5;
    return defences;
  }

  defences.rocketLauncher = safeTier * 8;
  defences.lightLaser = safeTier * 3;

  if (safeTier >= 5) {
    defences.heavyLaser = safeTier * 2;
    defences.ionCannon = safeTier;
  }

  if (safeTier >= 7) {
    defences.gaussCannon = safeTier;
    defences.plasmaTurret = Math.floor(safeTier / 2);
  }

  if (safeTier >= 9) {
    defences.smallShieldDome = 1;
    defences.largeShieldDome = 1;
  }

  return defences;
}

export function buildNPCShipsForTier(tier: number): Record<string, number> {
  const safeTier = sanitizeTier(tier);
  const ships: Record<string, number> = {
    lightFighter: 0,
    heavyFighter: 0,
    cruiser: 0,
    battleship: 0,
    smallCargo: 0,
    largeCargo: 0,
    colonyShip: 0,
    recycler: 0,
    espionageProbe: 0,
    bomber: 0,
    destroyer: 0,
    battlecruiser: 0,
  };

  ships.smallCargo = safeTier * 2;

  if (safeTier >= 3) {
    ships.lightFighter = safeTier * 5;
  }

  if (safeTier >= 5) {
    ships.heavyFighter = safeTier * 3;
    ships.cruiser = safeTier;
  }

  if (safeTier >= 7) {
    ships.battleship = safeTier;
    ships.largeCargo = safeTier * 2;
  }

  if (safeTier >= 9) {
    ships.destroyer = Math.floor(safeTier / 2);
    ships.battlecruiser = Math.floor(safeTier / 2);
  }

  return ships;
}

export function createNPCColonyForTier(
  coordinates: Coordinates,
  tier: number,
  seed: number,
): NPCColony {
  const safeTier = sanitizeTier(tier);
  const baseDefences = buildNPCDefencesForTier(safeTier);
  const baseShips = buildNPCShipsForTier(safeTier);
  const intervalMs = initialUpgradeIntervalMsForTier(safeTier);
  const specialty = specialtyForCoordinates(seed, coordinates);
  const stats = planetStatsForSlot(seed, coordinates);

  return {
    coordinates: { ...coordinates },
    name: nameForNPC(seed, coordinates),
    temperature: stats.maxTemperature,
    tier: safeTier,
    specialty,
    maxTier: maxTierForNPC(safeTier),
    initialUpgradeIntervalMs: intervalMs,
    currentUpgradeIntervalMs: intervalMs,
    lastUpgradeAt: 0,
    upgradeTickCount: 0,
    raidCount: 0,
    recentRaidTimestamps: [],
    abandonedAt: undefined,
    buildings: buildNPCBuildingsForTier(safeTier),
    baseDefences,
    baseShips,
    currentDefences: { ...baseDefences },
    currentShips: { ...baseShips },
    lastRaidedAt: 0,
    resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
  };
}

export function calcNPCEspionageLevel(colony: NPCColony): number {
  if (colony.specialty === 'researcher') {
    return Math.floor((colony.buildings.researchLab ?? 0) / 2);
  }
  return Math.floor(colony.tier / 2);
}

function getInterpolatedForce(
  current: Record<string, number>,
  base: Record<string, number>,
  recoverRatio: number,
): Record<string, number> {
  const interpolated: Record<string, number> = {};
  const ids = new Set([...Object.keys(base), ...Object.keys(current)]);

  for (const id of ids) {
    const currentValue = current[id] ?? 0;
    const baseValue = base[id] ?? 0;
    const value = Math.floor(currentValue + (baseValue - currentValue) * recoverRatio);
    if (value > 0) {
      interpolated[id] = value;
    }
  }

  return interpolated;
}

function createNPCProductionPlanet(colony: NPCColony): PlanetState {
  return {
    name: colony.name,
    coordinates: { ...colony.coordinates },
    maxTemperature: colony.temperature,
    maxFields: 0,
    fieldCount: 0,
    buildings: {
      metalMine: colony.buildings.metalMine ?? 0,
      crystalMine: colony.buildings.crystalMine ?? 0,
      deuteriumSynthesizer: colony.buildings.deuteriumSynthesizer ?? 0,
      solarPlant: colony.buildings.solarPlant ?? 0,
      fusionReactor: colony.buildings.fusionReactor ?? 0,
      metalStorage: colony.buildings.metalStorage ?? 0,
      crystalStorage: colony.buildings.crystalStorage ?? 0,
      deuteriumTank: colony.buildings.deuteriumTank ?? 0,
      roboticsFactory: colony.buildings.roboticsFactory ?? 0,
      naniteFactory: colony.buildings.naniteFactory ?? 0,
      shipyard: colony.buildings.shipyard ?? 0,
      researchLab: colony.buildings.researchLab ?? 0,
    },
    ships: {
      lightFighter: 0,
      heavyFighter: 0,
      cruiser: 0,
      battleship: 0,
      smallCargo: 0,
      largeCargo: 0,
      colonyShip: 0,
      recycler: 0,
      espionageProbe: 0,
      bomber: 0,
      destroyer: 0,
      battlecruiser: 0,
    },
    defences: {
      rocketLauncher: 0,
      lightLaser: 0,
      heavyLaser: 0,
      gaussCannon: 0,
      ionCannon: 0,
      plasmaTurret: 0,
      smallShieldDome: 0,
      largeShieldDome: 0,
    },
    resources: {
      metal: 0,
      crystal: 0,
      deuterium: 0,
      energyProduction: 0,
      energyConsumption: 0,
    },
    buildingQueue: [],
    shipyardQueue: [],
  };
}

/** Generate NPC colonies for the galaxy based on seed. */
export function generateNPCColonies(seed: number): NPCColony[] {
  const rng = mulberry32(seed);
  const colonies: NPCColony[] = [];

  for (let system = 1; system <= GALAXY_CONSTANTS.MAX_SYSTEMS; system += 1) {
    const npcCount = 2 + Math.floor(rng() * 4); // 2-5
    const availableSlots: number[] = [];

    for (let slot = 1; slot <= GALAXY_CONSTANTS.MAX_SLOTS; slot += 1) {
      if (system === 1 && slot === 4) {
        continue;
      }
      availableSlots.push(slot);
    }

    for (let i = 0; i < npcCount && availableSlots.length > 0; i += 1) {
      const slotIndex = Math.floor(rng() * availableSlots.length);
      const [slot] = availableSlots.splice(slotIndex, 1);
      if (slot === undefined) {
        continue;
      }

      const systemDistance = Math.abs(system - 1);
      const baseTier = Math.floor(
        1 + (systemDistance / GALAXY_CONSTANTS.MAX_SYSTEMS) * 9,
      );
      const tierOffset = Math.floor(rng() * 3) - 1;
      const tier = sanitizeTier(clamp(1, baseTier + tierOffset, 10));
      const baseDefences = buildNPCDefencesForTier(tier);
      const baseShips = buildNPCShipsForTier(tier);
      const intervalMs = initialUpgradeIntervalMsForTier(tier);
      const specialty = specialtyForCoordinates(seed, { galaxy: 1, system, slot });
      const stats = planetStatsForSlot(seed, { galaxy: 1, system, slot });

      colonies.push({
        coordinates: { galaxy: 1, system, slot },
        name: `${NPC_NAME_PREFIXES[Math.floor(rng() * NPC_NAME_PREFIXES.length)]} Colony`,
        temperature: stats.maxTemperature,
        tier,
        specialty,
        maxTier: maxTierForNPC(tier),
        initialUpgradeIntervalMs: intervalMs,
        currentUpgradeIntervalMs: intervalMs,
        lastUpgradeAt: 0,
        upgradeTickCount: 0,
        raidCount: 0,
        recentRaidTimestamps: [],
        abandonedAt: undefined,
        buildings: buildNPCBuildingsForTier(tier),
        baseDefences,
        baseShips,
        currentDefences: { ...baseDefences },
        currentShips: { ...baseShips },
        lastRaidedAt: 0,
        resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
      });
    }
  }

  return colonies;
}

/** Get resources currently stockpiled by an NPC colony from passive production. */
export function getNPCResources(
  colony: NPCColony,
  now: number,
  gameSpeed: number,
): { metal: number; crystal: number; deuterium: number } {
  if (colony.abandonedAt !== undefined) {
    return { metal: 0, crystal: 0, deuterium: 0 };
  }

  const productionPlanet = createNPCProductionPlanet(colony);
  const production = calculateProduction(productionPlanet, NPC_RESEARCH_LEVELS);
  const elapsedMs = Math.max(0, now - (colony.lastRaidedAt || 0));
  const safeGameSpeed = Math.max(0, gameSpeed);
  const elapsedHours = (elapsedMs * safeGameSpeed) / 3_600_000;
  const stockpileCap = {
    metal: production.metalPerHour * NPC_RESOURCE_CAP_HOURS,
    crystal: production.crystalPerHour * NPC_RESOURCE_CAP_HOURS,
    deuterium: production.deuteriumPerHour * NPC_RESOURCE_CAP_HOURS,
  };
  const baseline = colony.resourcesAtLastRaid ?? {
    metal: 0,
    crystal: 0,
    deuterium: 0,
  };

  return {
    metal: Math.max(
      0,
      Math.floor(
        Math.min(
          stockpileCap.metal,
          baseline.metal + production.metalPerHour * elapsedHours,
        ),
      ),
    ),
    crystal: Math.max(
      0,
      Math.floor(
        Math.min(
          stockpileCap.crystal,
          baseline.crystal + production.crystalPerHour * elapsedHours,
        ),
      ),
    ),
    deuterium: Math.max(
      0,
      Math.floor(
        Math.min(
          stockpileCap.deuterium,
          baseline.deuterium + production.deuteriumPerHour * elapsedHours,
        ),
      ),
    ),
  };
}

/** Interpolate fleet and defence regeneration from current to base over 48 hours. */
export function getNPCCurrentForce(
  colony: NPCColony,
  now: number,
): { ships: Record<string, number>; defences: Record<string, number> } {
  if (colony.lastRaidedAt === 0) {
    return {
      ships: { ...colony.baseShips },
      defences: { ...colony.baseDefences },
    };
  }

  const elapsedMs = clamp(0, now - colony.lastRaidedAt, NPC_RECOVERY_MS);
  const recoverRatio = elapsedMs / NPC_RECOVERY_MS;

  return {
    ships: getInterpolatedForce(colony.currentShips, colony.baseShips, recoverRatio),
    defences: getInterpolatedForce(
      colony.currentDefences,
      colony.baseDefences,
      recoverRatio,
    ),
  };
}

export function addDebris(
  state: GameState,
  coordinates: Coordinates,
  metal: number,
  crystal: number,
): void {
  const safeMetal = Math.max(0, Math.floor(metal));
  const safeCrystal = Math.max(0, Math.floor(crystal));
  if (safeMetal === 0 && safeCrystal === 0) {
    return;
  }

  const existing = state.debrisFields.find(
    (field) =>
      field.coordinates.galaxy === coordinates.galaxy &&
      field.coordinates.system === coordinates.system &&
      field.coordinates.slot === coordinates.slot,
  );

  if (existing) {
    existing.metal += safeMetal;
    existing.crystal += safeCrystal;
    return;
  }

  state.debrisFields.push({
    coordinates: { ...coordinates },
    metal: safeMetal,
    crystal: safeCrystal,
  });
}

/** Get what occupies each slot in a system. */
export interface SystemSlot {
  type: 'empty' | 'player' | 'npc';
  planet?: PlanetState;
  npc?: NPCColony;
}

export function getSystemSlots(
  state: GameState,
  galaxy: number,
  system: number,
): SystemSlot[] {
  const slots: SystemSlot[] = [];

  for (let slot = 1; slot <= GALAXY_CONSTANTS.MAX_SLOTS; slot += 1) {
    const playerPlanet = state.planets.find(
      (planet) =>
        planet.coordinates.galaxy === galaxy &&
        planet.coordinates.system === system &&
        planet.coordinates.slot === slot,
    );

    if (playerPlanet) {
      slots.push({ type: 'player', planet: playerPlanet });
      continue;
    }

    const npc = state.galaxy.npcColonies.find(
      (colony) =>
        colony.coordinates.galaxy === galaxy &&
        colony.coordinates.system === system &&
        colony.coordinates.slot === slot,
    );

    if (npc) {
      slots.push({ type: 'npc', npc });
    } else {
      slots.push({ type: 'empty' });
    }
  }

  return slots;
}

/** Check if player can colonize: needs a colony ship on the active planet. */
export function canColonize(state: GameState): boolean {
  const planet = activePlanet(state);
  if (planet.ships[GALAXY_CONSTANTS.COLONY_SHIP_ID] <= 0) return false;

  const astroLevel = state.research.astrophysicsTechnology ?? 0;
  const maxColonies = Math.floor(astroLevel / 2) + (astroLevel > 0 ? 1 : 0);
  // Level 0 → 0 colonies, Level 1 → 1, Level 3 → 2, Level 5 → 3, etc.
  // Simplified: level 0 = 0, level >= 1: floor(level/2) + 1
  const currentColonies = state.planets.length - 1; // exclude homeworld
  return currentColonies < maxColonies;
}

/** Check if a slot is available for colonization. */
export function isSlotEmpty(state: GameState, coordinates: Coordinates): boolean {
  const hasPlayer = state.planets.some(
    (planet) =>
      planet.coordinates.galaxy === coordinates.galaxy &&
      planet.coordinates.system === coordinates.system &&
      planet.coordinates.slot === coordinates.slot,
  );
  if (hasPlayer) return false;

  const hasNpc = state.galaxy.npcColonies.some(
    (colony) =>
      colony.coordinates.galaxy === coordinates.galaxy &&
      colony.coordinates.system === coordinates.system &&
      colony.coordinates.slot === coordinates.slot,
  );
  return !hasNpc;
}

export function adminAddNPC(
  state: GameState,
  coordinates: Coordinates,
  tier: number,
): NPCColony | null {
  if (!isSlotEmpty(state, coordinates)) {
    return null;
  }

  const colony = createNPCColonyForTier(
    coordinates,
    sanitizeTier(tier),
    state.galaxy.seed,
  );
  state.galaxy.npcColonies.push(colony);
  return colony;
}

/** Colonize a planet at the given coordinates. Consumes a colony ship. Returns the new planet or null on failure. */
export function colonize(
  state: GameState,
  coordinates: Coordinates,
): PlanetState | null {
  if (!canColonize(state)) return null;
  if (!isSlotEmpty(state, coordinates)) return null;

  // Consume colony ship from active planet
  const planet = activePlanet(state);
  planet.ships[GALAXY_CONSTANTS.COLONY_SHIP_ID] -= 1;

  // Create new planet
  const newPlanet = createDefaultPlanet();
  newPlanet.name = `Colony ${state.planets.length + 1}`;
  newPlanet.coordinates = { ...coordinates };
  const rerollSeed = Date.now() ^ (coordinates.system * 1000 + coordinates.slot * 17);
  const stats = planetStatsForSlot(rerollSeed, coordinates);
  newPlanet.maxTemperature = stats.maxTemperature;
  newPlanet.maxFields = stats.maxFields;
  newPlanet.fieldCount = stats.maxFields;

  state.planets.push(newPlanet);
  return newPlanet;
}
