import type { GameState } from '../models/GameState.ts';
import { SHIPS } from '../data/ships.ts';
import { DEFENCES } from '../data/defences.ts';
import { computePlayerScores } from '../engine/ScoreEngine.ts';

export interface RankingEntry {
  name: string;
  economy: number;
  research: number;
  military: number;
  fleet: number;
  total: number;
  isPlayer: boolean;
}

/**
 * Compute rankings for all entities (player + NPC colonies).
 * Pure function — no Date.now(), no Math.random().
 * Returns entries sorted by total score descending (stable; ties preserve insertion order).
 */
export function computeRankings(gameState: GameState): RankingEntry[] {
  const entries: RankingEntry[] = [];

  // Player entry — compute fresh scores from current state so rankings
  // reflect building/research changes even when playerScores cache is stale.
  const freshScores = computePlayerScores(gameState);
  // Accumulated scores (buildings, fleet, defence) are tracked via playerScores.
  const accumulated = gameState.playerScores;
  const playerFleet = accumulated.fleet ?? 0;
  const playerEconomy = freshScores.economy;
  const playerResearch = freshScores.research;
  const playerMilitary = freshScores.military;
  const playerTotal = playerEconomy + playerResearch + playerMilitary + playerFleet;

  const playerName =
    gameState.planets[gameState.activePlanetIndex]?.name || 'You';

  entries.push({
    name: playerName,
    economy: playerEconomy,
    research: playerResearch,
    military: playerMilitary,
    fleet: playerFleet,
    total: playerTotal,
    isPlayer: true,
  });

  // NPC entries
  for (const colony of gameState.galaxy.npcColonies) {
    const economy = colony.tier * 500_000;
    const research = colony.tier * 180_000;

    // military = ships weapon power + defences weapon power
    let shipWeapon = 0;
    for (const [id, count] of Object.entries(colony.currentShips ?? {})) {
      const count_ = count ?? 0;
      if (count_ <= 0) continue;
      const shipDef = SHIPS[id as keyof typeof SHIPS];
      if (shipDef) {
        shipWeapon += count_ * shipDef.weaponPower;
      }
    }

    let defenceWeapon = 0;
    for (const [id, count] of Object.entries(colony.currentDefences ?? {})) {
      const count_ = count ?? 0;
      if (count_ <= 0) continue;
      const defDef = DEFENCES[id as keyof typeof DEFENCES];
      if (defDef) {
        defenceWeapon += count_ * defDef.weaponPower;
      }
    }

    const military = shipWeapon + defenceWeapon;
    const fleet = shipWeapon; // ships only (not defences)
    const total = economy + research + military + fleet;

    entries.push({
      name: colony.name,
      economy,
      research,
      military,
      fleet,
      total,
      isPlayer: false,
    });
  }

  // Stable sort by total descending
  entries.sort((a, b) => b.total - a.total);

  return entries;
}
