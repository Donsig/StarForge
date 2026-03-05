import { DEFENCES } from '../data/defences.ts';
import { SHIPS } from '../data/ships.ts';
import { RAPID_FIRE } from '../data/combat.ts';
import type {
  AttackerTechs,
  CombatResult,
  DefenderTechs,
  UnitSnapshot,
} from '../models/Combat.ts';

interface CombatSide {
  ships: Partial<Record<string, number>>;
  techs: AttackerTechs | DefenderTechs;
}

interface DefenderSide extends CombatSide {
  defences: Partial<Record<string, number>>;
}

interface UnitInstance {
  uid: number;
  id: string;
  kind: 'ship' | 'defence';
  attack: number;
  maxShield: number;
  currentShield: number;
  maxHull: number;
  currentHull: number;
  destroyed: boolean;
}

interface Shot {
  targetUid: number;
  damage: number;
}

const MAX_ROUNDS = 6;
const DEFENCE_REBUILD_RATE = 0.7;
const MAX_RAPID_FIRE_CHAIN = 10000;
const SHIP_DEFINITIONS_BY_ID = SHIPS as Record<
  string,
  (typeof SHIPS)[keyof typeof SHIPS] | undefined
>;
const DEFENCE_DEFINITIONS_BY_ID = DEFENCES as Record<
  string,
  (typeof DEFENCES)[keyof typeof DEFENCES] | undefined
>;

/** Seedable PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function compactCounts(
  counts: Partial<Record<string, number>>,
): Partial<Record<string, number>> {
  const compacted: Partial<Record<string, number>> = {};
  for (const [id, value] of Object.entries(counts)) {
    const safeValue = Math.max(0, Math.floor(value ?? 0));
    if (safeValue > 0) {
      compacted[id] = safeValue;
    }
  }
  return compacted;
}

function normalizeShips(ships: Partial<Record<string, number>>): Partial<Record<string, number>> {
  const normalized: Partial<Record<string, number>> = {};
  for (const [id, count] of Object.entries(ships)) {
    if (!SHIP_DEFINITIONS_BY_ID[id]) continue;
    const safeCount = Math.max(0, Math.floor(count ?? 0));
    if (safeCount > 0) {
      normalized[id] = safeCount;
    }
  }
  return normalized;
}

function normalizeDefences(
  defences: Partial<Record<string, number>>,
): Partial<Record<string, number>> {
  const normalized: Partial<Record<string, number>> = {};
  for (const [id, count] of Object.entries(defences)) {
    if (!DEFENCE_DEFINITIONS_BY_ID[id]) continue;
    const safeCount = Math.max(0, Math.floor(count ?? 0));
    if (safeCount > 0) {
      normalized[id] = safeCount;
    }
  }
  return normalized;
}

function addScaledStat(base: number, level: number): number {
  return base * (1 + 0.1 * level);
}

function buildShipUnits(
  ships: Partial<Record<string, number>>,
  techs: AttackerTechs | DefenderTechs,
  uidStart: number,
): UnitInstance[] {
  const units: UnitInstance[] = [];
  let nextUid = uidStart;

  for (const [id, count] of Object.entries(ships)) {
    const definition = SHIP_DEFINITIONS_BY_ID[id];
    if (!definition) continue;
    const unitCount = Math.max(0, Math.floor(count ?? 0));
    for (let i = 0; i < unitCount; i += 1) {
      const attack = addScaledStat(definition.attack, techs.weaponsTechnology);
      const shield = addScaledStat(definition.shield, techs.shieldingTechnology);
      const hull = addScaledStat(definition.hull, techs.armourTechnology);
      units.push({
        uid: nextUid,
        id,
        kind: 'ship',
        attack,
        maxShield: shield,
        currentShield: shield,
        maxHull: hull,
        currentHull: hull,
        destroyed: false,
      });
      nextUid += 1;
    }
  }

  return units;
}

function buildDefenceUnits(
  defences: Partial<Record<string, number>>,
  techs: AttackerTechs | DefenderTechs,
  uidStart: number,
): UnitInstance[] {
  const units: UnitInstance[] = [];
  let nextUid = uidStart;

  for (const [id, count] of Object.entries(defences)) {
    const definition = DEFENCE_DEFINITIONS_BY_ID[id];
    if (!definition) continue;
    const unitCount = Math.max(0, Math.floor(count ?? 0));
    for (let i = 0; i < unitCount; i += 1) {
      const attack = addScaledStat(definition.attack, techs.weaponsTechnology);
      const shield = addScaledStat(definition.shield, techs.shieldingTechnology);
      const hull = addScaledStat(definition.hull, techs.armourTechnology);
      units.push({
        uid: nextUid,
        id,
        kind: 'defence',
        attack,
        maxShield: shield,
        currentShield: shield,
        maxHull: hull,
        currentHull: hull,
        destroyed: false,
      });
      nextUid += 1;
    }
  }

  return units;
}

function resetShields(units: UnitInstance[]): void {
  for (const unit of units) {
    if (!unit.destroyed) {
      unit.currentShield = unit.maxShield;
    }
  }
}

function hasAliveUnits(units: UnitInstance[]): boolean {
  return units.some((unit) => !unit.destroyed);
}

function getAliveTargetUids(units: UnitInstance[]): number[] {
  return units.filter((unit) => !unit.destroyed).map((unit) => unit.uid);
}

function createUnitMap(units: UnitInstance[]): Map<number, UnitInstance> {
  return new Map(units.map((unit) => [unit.uid, unit]));
}

function pickRandomTarget(targetUids: number[], rng: () => number): number {
  const index = Math.floor(rng() * targetUids.length);
  return targetUids[index];
}

function createVolley(
  shooters: UnitInstance[],
  targetUids: number[],
  targetMap: Map<number, UnitInstance>,
  rng: () => number,
): Shot[] {
  if (targetUids.length === 0) return [];

  const volley: Shot[] = [];
  for (const shooter of shooters) {
    if (shooter.destroyed) continue;

    let chainLength = 0;
    while (chainLength < MAX_RAPID_FIRE_CHAIN) {
      const targetUid = pickRandomTarget(targetUids, rng);
      const target = targetMap.get(targetUid);
      if (!target) break;

      volley.push({ targetUid, damage: shooter.attack });
      chainLength += 1;

      const rapidFireValue = RAPID_FIRE[shooter.id]?.[target.id];
      if (!rapidFireValue || rapidFireValue <= 1) break;

      const repeatChance = (rapidFireValue - 1) / rapidFireValue;
      if (rng() >= repeatChance) break;
    }
  }

  return volley;
}

function destroyUnit(unit: UnitInstance): void {
  unit.currentHull = 0;
  unit.currentShield = 0;
  unit.destroyed = true;
}

function applyShot(shot: Shot, target: UnitInstance, rng: () => number): void {
  if (target.destroyed) return;

  // If attack is below 1% of current shield, the shot is deflected.
  if (shot.damage < 0.01 * target.currentShield) {
    return;
  }

  // After dropping below 70% hull, each hit can trigger an immediate explosion.
  if (target.currentHull < target.maxHull * 0.7) {
    const explosionChance = 1 - target.currentHull / target.maxHull;
    if (rng() < explosionChance) {
      destroyUnit(target);
      return;
    }
  }

  let remainingDamage = shot.damage;
  if (target.currentShield > 0) {
    const shieldAbsorbed = Math.min(target.currentShield, remainingDamage);
    target.currentShield -= shieldAbsorbed;
    remainingDamage -= shieldAbsorbed;
  }

  if (remainingDamage > 0) {
    target.currentHull -= remainingDamage;
    if (target.currentHull <= 0) {
      destroyUnit(target);
    }
  }
}

function resolveVolley(shots: Shot[], targetMap: Map<number, UnitInstance>, rng: () => number): void {
  for (const shot of shots) {
    const target = targetMap.get(shot.targetUid);
    if (!target || target.destroyed) continue;
    applyShot(shot, target, rng);
  }
}

function countUnitsByKind(
  units: UnitInstance[],
  kind: UnitInstance['kind'],
): Partial<Record<string, number>> {
  const counts: Partial<Record<string, number>> = {};
  for (const unit of units) {
    if (unit.destroyed || unit.kind !== kind) continue;
    counts[unit.id] = (counts[unit.id] ?? 0) + 1;
  }
  return compactCounts(counts);
}

function calculateLosses(
  start: Partial<Record<string, number>>,
  end: Partial<Record<string, number>>,
): Partial<Record<string, number>> {
  const losses: Partial<Record<string, number>> = {};
  for (const [id, startCount] of Object.entries(start)) {
    const safeStartCount = Math.max(0, Math.floor(startCount ?? 0));
    const remaining = end[id] ?? 0;
    const loss = Math.max(0, safeStartCount - remaining);
    if (loss > 0) {
      losses[id] = loss;
    }
  }
  return compactCounts(losses);
}

function applyDefenceRebuild(
  defenderStartDefences: Partial<Record<string, number>>,
  defenderEndDefencesBeforeRebuild: Partial<Record<string, number>>,
): {
  rebuilt: Record<string, number>;
  defenderEndDefences: Partial<Record<string, number>>;
  permanentLosses: Partial<Record<string, number>>;
} {
  const destroyedDefences = calculateLosses(
    defenderStartDefences,
    defenderEndDefencesBeforeRebuild,
  );
  const rebuilt: Record<string, number> = {};
  const defenderEndDefences: Partial<Record<string, number>> = {
    ...defenderEndDefencesBeforeRebuild,
  };

  for (const [id, destroyedCount] of Object.entries(destroyedDefences)) {
    const rebuiltCount = Math.floor((destroyedCount ?? 0) * DEFENCE_REBUILD_RATE);
    if (rebuiltCount <= 0) continue;
    rebuilt[id] = rebuiltCount;
    defenderEndDefences[id] = (defenderEndDefences[id] ?? 0) + rebuiltCount;
  }

  const permanentLosses = calculateLosses(defenderStartDefences, defenderEndDefences);
  return {
    rebuilt,
    defenderEndDefences: compactCounts(defenderEndDefences),
    permanentLosses,
  };
}

function calculateDebris(losses: UnitSnapshot): { metal: number; crystal: number } {
  let metal = 0;
  let crystal = 0;
  for (const [shipId, count] of Object.entries(losses.ships)) {
    const ship = SHIP_DEFINITIONS_BY_ID[shipId];
    if (!ship) continue;
    const safeCount = Math.max(0, Math.floor(count ?? 0));
    metal += ship.cost.metal * safeCount * 0.3;
    crystal += ship.cost.crystal * safeCount * 0.3;
  }
  return {
    metal: Math.floor(metal),
    crystal: Math.floor(crystal),
  };
}

function mergeDebris(
  attackerLosses: UnitSnapshot,
  defenderLosses: UnitSnapshot,
): { metal: number; crystal: number } {
  const attackerDebris = calculateDebris(attackerLosses);
  const defenderDebris = calculateDebris(defenderLosses);
  return {
    metal: attackerDebris.metal + defenderDebris.metal,
    crystal: attackerDebris.crystal + defenderDebris.crystal,
  };
}

export function simulate(
  attacker: CombatSide,
  defender: DefenderSide,
  seed: number,
): CombatResult {
  const rng = mulberry32(seed);

  const attackerStartShips = normalizeShips(attacker.ships);
  const defenderStartShips = normalizeShips(defender.ships);
  const defenderStartDefences = normalizeDefences(defender.defences);

  const attackerUnits = buildShipUnits(attackerStartShips, attacker.techs, 1);
  const defenderShipUnits = buildShipUnits(defenderStartShips, defender.techs, attackerUnits.length + 1);
  const defenderDefenceUnits = buildDefenceUnits(
    defenderStartDefences,
    defender.techs,
    attackerUnits.length + defenderShipUnits.length + 1,
  );
  const defenderUnits = [...defenderShipUnits, ...defenderDefenceUnits];

  const attackerMap = createUnitMap(attackerUnits);
  const defenderMap = createUnitMap(defenderUnits);

  let rounds = 0;

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    if (!hasAliveUnits(attackerUnits) || !hasAliveUnits(defenderUnits)) {
      break;
    }

    rounds = round;

    resetShields(attackerUnits);
    resetShields(defenderUnits);

    const defenderTargets = getAliveTargetUids(defenderUnits);
    const attackerVolley = createVolley(attackerUnits, defenderTargets, defenderMap, rng);

    const attackerTargets = getAliveTargetUids(attackerUnits);
    const defenderVolley = createVolley(defenderUnits, attackerTargets, attackerMap, rng);

    // Volleys are generated before either side takes damage, then resolved together.
    resolveVolley(attackerVolley, defenderMap, rng);
    resolveVolley(defenderVolley, attackerMap, rng);
  }

  const attackerAlive = hasAliveUnits(attackerUnits);
  const defenderAlive = hasAliveUnits(defenderUnits);

  let outcome: CombatResult['outcome'] = 'draw';
  if (attackerAlive && !defenderAlive) {
    outcome = 'attacker_wins';
  } else if (!attackerAlive && defenderAlive) {
    outcome = 'defender_wins';
  }

  const attackerEndShips = countUnitsByKind(attackerUnits, 'ship');
  const defenderEndShips = countUnitsByKind(defenderUnits, 'ship');
  const defenderEndDefencesBeforeRebuild = countUnitsByKind(defenderUnits, 'defence');

  const attackerLosses: UnitSnapshot = {
    ships: calculateLosses(attackerStartShips, attackerEndShips),
  };

  const defenderShipLosses = calculateLosses(defenderStartShips, defenderEndShips);
  const {
    rebuilt: defencesRebuilt,
    defenderEndDefences,
    permanentLosses: defenderDefenceLosses,
  } = applyDefenceRebuild(defenderStartDefences, defenderEndDefencesBeforeRebuild);

  const defenderLosses: UnitSnapshot = {
    ships: defenderShipLosses,
    defences: defenderDefenceLosses,
  };

  return {
    seed,
    outcome,
    rounds,
    attackerStart: { ships: attackerStartShips },
    attackerEnd: { ships: attackerEndShips },
    defenderStart: { ships: defenderStartShips, defences: defenderStartDefences },
    defenderEnd: { ships: defenderEndShips, defences: defenderEndDefences },
    attackerLosses,
    defenderLosses,
    defencesRebuilt,
    debrisCreated: mergeDebris(attackerLosses, defenderLosses),
    loot: { metal: 0, crystal: 0, deuterium: 0 },
  };
}
