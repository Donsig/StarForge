import type { GameState } from '../models/GameState.ts';
import type { Coordinates, NPCColony } from '../models/Galaxy.ts';
import type { PlanetState } from '../models/Planet.ts';
import { createDefaultPlanet } from '../models/Planet.ts';
import { GALAXY_CONSTANTS } from '../data/galaxy.ts';
import { calculateProduction } from './ResourceEngine.ts';
import { activePlanet } from './helpers.ts';

const NPC_RECOVERY_MS = 48 * 3600 * 1000;
const GAME_START_TIME = 0;

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

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeTier(tier: number): number {
  return clamp(1, Math.floor(tier), 10);
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

  return {
    coordinates: { ...coordinates },
    name: nameForNPC(seed, coordinates),
    tier: safeTier,
    buildings: buildNPCBuildingsForTier(safeTier),
    baseDefences,
    baseShips,
    currentDefences: { ...baseDefences },
    currentShips: { ...baseShips },
    lastRaidedAt: 0,
  };
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
    maxTemperature: 20 + colony.tier * 3,
    maxFields: 0,
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
      const tier = clamp(1, baseTier + tierOffset, 10);

      const baseDefences = buildNPCDefencesForTier(tier);
      const baseShips = buildNPCShipsForTier(tier);

      colonies.push({
        coordinates: { galaxy: 1, system, slot },
        name: `${NPC_NAME_PREFIXES[Math.floor(rng() * NPC_NAME_PREFIXES.length)]} Colony`,
        tier,
        buildings: buildNPCBuildingsForTier(tier),
        baseDefences,
        baseShips,
        currentDefences: { ...baseDefences },
        currentShips: { ...baseShips },
        lastRaidedAt: 0,
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
  const productionPlanet = createNPCProductionPlanet(colony);
  const production = calculateProduction(productionPlanet, NPC_RESEARCH_LEVELS);
  const elapsedFrom = colony.lastRaidedAt || GAME_START_TIME;
  const safeGameSpeed = Math.max(0, gameSpeed);
  const elapsedMs = clamp(0, now - elapsedFrom, NPC_RECOVERY_MS);
  const elapsedSeconds = Math.min(
    (elapsedMs / 1000) * safeGameSpeed,
    (NPC_RECOVERY_MS / 1000) * safeGameSpeed,
  );

  return {
    metal: Math.max(0, Math.floor((production.metalPerHour / 3600) * elapsedSeconds)),
    crystal: Math.max(0, Math.floor((production.crystalPerHour / 3600) * elapsedSeconds)),
    deuterium: Math.max(
      0,
      Math.floor((production.deuteriumPerHour / 3600) * elapsedSeconds),
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
  return planet.ships[GALAXY_CONSTANTS.COLONY_SHIP_ID] > 0;
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
  // Deterministic temperature variation by galaxy seed and target coordinates
  const coordSeed =
    state.galaxy.seed ^ (coordinates.system * 100 + coordinates.slot);
  const tempRng = mulberry32(coordSeed);
  newPlanet.maxTemperature = 20 + Math.floor(tempRng() * 30);

  state.planets.push(newPlanet);
  return newPlanet;
}
