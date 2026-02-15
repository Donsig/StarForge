import type { GameState } from '../models/GameState.ts';
import type { BuildingId, ResearchId, ShipId, QueueItem, ResourceCost } from '../models/types.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import {
  buildingCostAtLevel,
  researchCostAtLevel,
  buildingTime,
  researchTime,
  shipBuildTime,
} from './FormulasEngine.ts';

// ── Prerequisite checking ───────────────────────────────────────

export function prerequisitesMet(
  requires: { type: 'building' | 'research'; id: string; level: number }[],
  state: GameState,
): boolean {
  for (const req of requires) {
    if (req.type === 'building') {
      const level = state.planet.buildings[req.id as BuildingId];
      if (level === undefined || level < req.level) return false;
    } else {
      const level = state.research[req.id as ResearchId];
      if (level === undefined || level < req.level) return false;
    }
  }
  return true;
}

export function canAfford(cost: ResourceCost, state: GameState): boolean {
  const res = state.planet.resources;
  return (
    res.metal >= cost.metal &&
    res.crystal >= cost.crystal &&
    res.deuterium >= cost.deuterium
  );
}

function deductCost(cost: ResourceCost, state: GameState): void {
  state.planet.resources.metal -= cost.metal;
  state.planet.resources.crystal -= cost.crystal;
  state.planet.resources.deuterium -= cost.deuterium;
}

// ── Used building fields count ──────────────────────────────────

export function usedFields(state: GameState): number {
  let total = 0;
  for (const level of Object.values(state.planet.buildings)) {
    total += level;
  }
  return total;
}

// ── Building queue ──────────────────────────────────────────────

export function startBuildingUpgrade(
  state: GameState,
  buildingId: BuildingId,
): boolean {
  if (state.planet.buildingQueue !== null) return false;

  const def = BUILDINGS[buildingId];
  const currentLevel = state.planet.buildings[buildingId];
  const nextLevel = currentLevel + 1;
  const cost = buildingCostAtLevel(def.baseCost, def.costMultiplier, nextLevel);

  if (!canAfford(cost, state)) return false;
  if (!prerequisitesMet(def.requires, state)) return false;
  if (usedFields(state) >= state.planet.maxFields) return false;

  deductCost(cost, state);

  const duration = buildingTime(
    cost.metal,
    cost.crystal,
    state.planet.buildings.roboticsFactory,
    state.planet.buildings.naniteFactory,
    state.settings.gameSpeed,
  );

  const now = Date.now();
  state.planet.buildingQueue = {
    type: 'building',
    id: buildingId,
    targetLevel: nextLevel,
    startedAt: now,
    completesAt: now + duration * 1000,
  };

  return true;
}

export function cancelBuildingUpgrade(state: GameState): void {
  const item = state.planet.buildingQueue;
  if (!item) return;

  // Refund cost
  const def = BUILDINGS[item.id as BuildingId];
  const cost = buildingCostAtLevel(
    def.baseCost,
    def.costMultiplier,
    item.targetLevel!,
  );
  state.planet.resources.metal += cost.metal;
  state.planet.resources.crystal += cost.crystal;
  state.planet.resources.deuterium += cost.deuterium;

  state.planet.buildingQueue = null;
}

// ── Research queue ──────────────────────────────────────────────

export function startResearch(
  state: GameState,
  researchId: ResearchId,
): boolean {
  if (state.researchQueue !== null) return false;

  const def = RESEARCH[researchId];
  const currentLevel = state.research[researchId];
  const nextLevel = currentLevel + 1;
  const cost = researchCostAtLevel(def.baseCost, def.costMultiplier, nextLevel);

  if (!canAfford(cost, state)) return false;
  if (!prerequisitesMet(def.requires, state)) return false;

  deductCost(cost, state);

  const duration = researchTime(
    cost.metal,
    cost.crystal,
    state.planet.buildings.researchLab,
    state.settings.gameSpeed,
  );

  const now = Date.now();
  state.researchQueue = {
    type: 'research',
    id: researchId,
    targetLevel: nextLevel,
    startedAt: now,
    completesAt: now + duration * 1000,
  };

  return true;
}

export function cancelResearch(state: GameState): void {
  const item = state.researchQueue;
  if (!item) return;

  const def = RESEARCH[item.id as ResearchId];
  const cost = researchCostAtLevel(
    def.baseCost,
    def.costMultiplier,
    item.targetLevel!,
  );
  state.planet.resources.metal += cost.metal;
  state.planet.resources.crystal += cost.crystal;
  state.planet.resources.deuterium += cost.deuterium;

  state.researchQueue = null;
}

// ── Shipyard queue ──────────────────────────────────────────────

export function startShipBuild(
  state: GameState,
  shipId: ShipId,
  quantity: number,
): boolean {
  if (quantity <= 0) return false;

  const def = SHIPS[shipId];
  if (!prerequisitesMet(def.requires, state)) return false;

  // Check cost for entire batch
  const totalCost: ResourceCost = {
    metal: def.cost.metal * quantity,
    crystal: def.cost.crystal * quantity,
    deuterium: def.cost.deuterium * quantity,
  };
  if (!canAfford(totalCost, state)) return false;

  deductCost(totalCost, state);

  const perUnitSeconds = shipBuildTime(
    def.structuralIntegrity,
    state.planet.buildings.shipyard,
    state.planet.buildings.naniteFactory,
    state.settings.gameSpeed,
  );

  const now = Date.now();
  state.planet.shipyardQueue.push({
    type: 'ship',
    id: shipId,
    quantity,
    completed: 0,
    startedAt: now,
    completesAt: now + perUnitSeconds * 1000,
  });

  return true;
}

// ── Tick processing ─────────────────────────────────────────────

export function processTick(state: GameState, now: number = Date.now()): void {
  // Building queue
  if (state.planet.buildingQueue && now >= state.planet.buildingQueue.completesAt) {
    const item = state.planet.buildingQueue;
    state.planet.buildings[item.id as BuildingId] = item.targetLevel!;
    state.planet.buildingQueue = null;
  }

  // Research queue
  if (state.researchQueue && now >= state.researchQueue.completesAt) {
    const item = state.researchQueue;
    state.research[item.id as ResearchId] = item.targetLevel!;
    state.researchQueue = null;
  }

  // Shipyard queue (process front item)
  if (state.planet.shipyardQueue.length > 0) {
    const item = state.planet.shipyardQueue[0];
    if (now >= item.completesAt) {
      item.completed = (item.completed ?? 0) + 1;
      state.planet.ships[item.id as ShipId] += 1;

      if (item.completed >= item.quantity!) {
        // Batch done, remove from queue
        state.planet.shipyardQueue.shift();
      } else {
        // Start next unit
        const def = SHIPS[item.id as ShipId];
        const perUnitSeconds = shipBuildTime(
          def.structuralIntegrity,
          state.planet.buildings.shipyard,
          state.planet.buildings.naniteFactory,
          state.settings.gameSpeed,
        );
        item.completesAt = now + perUnitSeconds * 1000;
      }
    }
  }
}

/** Rescale active queue completion times when game speed changes mid-build.
 *  Remaining time is scaled by (oldSpeed / newSpeed) so faster speed = shorter wait. */
export function rescaleQueueTimes(
  state: GameState,
  oldSpeed: number,
  newSpeed: number,
  now: number = Date.now(),
): void {
  if (oldSpeed === newSpeed) return;
  const ratio = oldSpeed / newSpeed;

  // Building queue
  if (state.planet.buildingQueue) {
    const remaining = state.planet.buildingQueue.completesAt - now;
    if (remaining > 0) {
      state.planet.buildingQueue.completesAt = now + remaining * ratio;
    }
  }

  // Research queue
  if (state.researchQueue) {
    const remaining = state.researchQueue.completesAt - now;
    if (remaining > 0) {
      state.researchQueue.completesAt = now + remaining * ratio;
    }
  }

  // Shipyard queue (only the front item has an active timer)
  if (state.planet.shipyardQueue.length > 0) {
    const item = state.planet.shipyardQueue[0];
    const remaining = item.completesAt - now;
    if (remaining > 0) {
      item.completesAt = now + remaining * ratio;
    }
  }
}

/** Get all queue completion events sorted chronologically (for offline catch-up) */
export function getCompletionEvents(state: GameState): QueueItem[] {
  const events: QueueItem[] = [];

  if (state.planet.buildingQueue) {
    events.push(state.planet.buildingQueue);
  }
  if (state.researchQueue) {
    events.push(state.researchQueue);
  }
  // For shipyard, each remaining unit is an event
  for (const item of state.planet.shipyardQueue) {
    const remaining = (item.quantity ?? 1) - (item.completed ?? 0);
    const def = SHIPS[item.id as ShipId];
    const perUnitSeconds = shipBuildTime(
      def.structuralIntegrity,
      state.planet.buildings.shipyard,
      state.planet.buildings.naniteFactory,
      state.settings.gameSpeed,
    );
    let nextCompletion = item.completesAt;
    for (let i = 0; i < remaining; i++) {
      events.push({
        ...item,
        completesAt: nextCompletion,
        completed: (item.completed ?? 0) + i,
      });
      nextCompletion += perUnitSeconds * 1000;
    }
  }

  events.sort((a, b) => a.completesAt - b.completesAt);
  return events;
}
