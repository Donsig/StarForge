import type { GameState } from '../models/GameState.ts';
import type { Coordinates, NPCColony } from '../models/Galaxy.ts';
import type { PlanetState } from '../models/Planet.ts';
import { createDefaultPlanet } from '../models/Planet.ts';
import { GALAXY_CONSTANTS } from '../data/galaxy.ts';
import { activePlanet } from './helpers.ts';

/** Simple seedable PRNG (mulberry32) */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate NPC colonies for the galaxy based on seed */
export function generateNPCColonies(seed: number): NPCColony[] {
  const rng = mulberry32(seed);
  const colonies: NPCColony[] = [];
  const npcNames = [
    'Zorgons', 'Kelvari', 'Nexari', 'Thorians', 'Vexari',
    'Drakari', 'Solmari', 'Cyphrans', 'Moldari', 'Xenthari',
  ];

  for (let sys = 1; sys <= GALAXY_CONSTANTS.MAX_SYSTEMS; sys++) {
    // Each system has 20-60% chance of having an NPC colony
    if (rng() < 0.4) {
      const slot = Math.floor(rng() * GALAXY_CONSTANTS.MAX_SLOTS) + 1;
      colonies.push({
        name: npcNames[Math.floor(rng() * npcNames.length)],
        coordinates: { galaxy: 1, system: sys, slot },
        strength: Math.floor(rng() * 100) + 10,
      });
    }
  }
  return colonies;
}

/** Get what occupies each slot in a system */
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

  for (let slot = 1; slot <= GALAXY_CONSTANTS.MAX_SLOTS; slot++) {
    const playerPlanet = state.planets.find(
      (p) =>
        p.coordinates.galaxy === galaxy &&
        p.coordinates.system === system &&
        p.coordinates.slot === slot,
    );

    if (playerPlanet) {
      slots.push({ type: 'player', planet: playerPlanet });
      continue;
    }

    const npc = state.galaxy.npcColonies.find(
      (c) =>
        c.coordinates.galaxy === galaxy &&
        c.coordinates.system === system &&
        c.coordinates.slot === slot,
    );

    if (npc) {
      slots.push({ type: 'npc', npc });
    } else {
      slots.push({ type: 'empty' });
    }
  }
  return slots;
}

/** Check if player can colonize: needs a colony ship on the active planet */
export function canColonize(state: GameState): boolean {
  const planet = activePlanet(state);
  return planet.ships[GALAXY_CONSTANTS.COLONY_SHIP_ID] > 0;
}

/** Check if a slot is available for colonization */
export function isSlotEmpty(state: GameState, coordinates: Coordinates): boolean {
  const hasPlayer = state.planets.some(
    (p) =>
      p.coordinates.galaxy === coordinates.galaxy &&
      p.coordinates.system === coordinates.system &&
      p.coordinates.slot === coordinates.slot,
  );
  if (hasPlayer) return false;

  const hasNpc = state.galaxy.npcColonies.some(
    (c) =>
      c.coordinates.galaxy === coordinates.galaxy &&
      c.coordinates.system === coordinates.system &&
      c.coordinates.slot === coordinates.slot,
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
  // Random temperature variation
  newPlanet.maxTemperature = 20 + Math.floor(Math.random() * 30);

  state.planets.push(newPlanet);
  return newPlanet;
}
