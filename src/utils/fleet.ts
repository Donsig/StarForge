import { SHIPS } from '../data/ships.ts';
import type { Coordinates } from '../models/Galaxy.ts';

/** Format a ship counts record into a human-readable manifest string.
 *  e.g. "3× Light Fighter, 1× Battleship" */
export function missionShipManifest(ships: Partial<Record<string, number>>): string {
  return Object.entries(ships)
    .map(([shipId, countValue]) => {
      const count = Math.max(0, Math.floor(countValue ?? 0));
      if (count <= 0) return null;
      const shipName = SHIPS[shipId as keyof typeof SHIPS]?.name ?? shipId;
      return `${count}× ${shipName}`;
    })
    .filter((entry): entry is string => entry !== null)
    .join(', ');
}

/** Format galaxy coordinates as "[G:x S:y P:z]" */
export function formatCoords(coords: Coordinates): string {
  return `[G:${coords.galaxy} S:${coords.system} P:${coords.slot}]`;
}
