import type { GameState } from '../models/GameState.ts';
import type {
  BuildingId,
  DefenceId,
  ResearchId,
  ShipId,
  QueueItem,
  ResourceCost,
} from '../models/types.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import {
  buildingCostAtLevel,
  researchCostAtLevel,
  buildingTime,
  researchTime,
  defenceBuildTime,
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
  const def = BUILDINGS[buildingId];
  const currentLevel = state.planet.buildings[buildingId];
  const queuedLevels = state.planet.buildingQueue.filter(
    (item) => item.id === buildingId,
  ).length;
  const nextLevel = currentLevel + queuedLevels + 1;
  const cost = buildingCostAtLevel(def.baseCost, def.costMultiplier, nextLevel);

  if (!canAfford(cost, state)) return false;
  if (!prerequisitesMet(def.requires, state)) return false;
  if (usedFields(state) + state.planet.buildingQueue.length >= state.planet.maxFields) {
    return false;
  }

  deductCost(cost, state);

  const duration = buildingTime(
    cost.metal,
    cost.crystal,
    state.planet.buildings.roboticsFactory,
    state.planet.buildings.naniteFactory,
    state.settings.gameSpeed,
  );

  const now = Date.now();
  const queue = state.planet.buildingQueue;
  const previousCompletion = queue.length > 0 ? queue[queue.length - 1].completesAt : now;
  queue.push({
    type: 'building',
    id: buildingId,
    targetLevel: nextLevel,
    startedAt: previousCompletion,
    completesAt: previousCompletion + duration * 1000,
  });

  return true;
}

export function cancelBuildingAtIndex(state: GameState, index: number): void {
  const queue = state.planet.buildingQueue;
  if (index < 0 || index >= queue.length) return;

  const selectedItem = queue[index];
  const selectedId = selectedItem.id;
  const selectedTargetLevel = selectedItem.targetLevel ?? 0;
  const removedItems: QueueItem[] = [];
  const keptItems: QueueItem[] = [];

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    if (
      i === index ||
      (i > index &&
        item.id === selectedId &&
        (item.targetLevel ?? 0) > selectedTargetLevel)
    ) {
      removedItems.push(item);
      continue;
    }
    keptItems.push(item);
  }

  for (const item of removedItems) {
    const def = BUILDINGS[item.id as BuildingId];
    const cost = buildingCostAtLevel(
      def.baseCost,
      def.costMultiplier,
      item.targetLevel!,
    );
    state.planet.resources.metal += cost.metal;
    state.planet.resources.crystal += cost.crystal;
    state.planet.resources.deuterium += cost.deuterium;
  }

  state.planet.buildingQueue = keptItems;

  if (index === 0 && state.planet.buildingQueue.length > 0) {
    const nextItem = state.planet.buildingQueue[0];
    const nextDef = BUILDINGS[nextItem.id as BuildingId];
    const nextCost = buildingCostAtLevel(
      nextDef.baseCost,
      nextDef.costMultiplier,
      nextItem.targetLevel!,
    );
    const nextDuration = buildingTime(
      nextCost.metal,
      nextCost.crystal,
      state.planet.buildings.roboticsFactory,
      state.planet.buildings.naniteFactory,
      state.settings.gameSpeed,
    );
    const now = Date.now();
    nextItem.startedAt = now;
    nextItem.completesAt = now + nextDuration * 1000;
  }
}

// ── Research queue ──────────────────────────────────────────────

export function startResearch(
  state: GameState,
  researchId: ResearchId,
): boolean {
  const def = RESEARCH[researchId];
  const currentLevel = state.research[researchId];
  const queuedLevels = state.researchQueue.filter(
    (item) => item.id === researchId,
  ).length;
  const nextLevel = currentLevel + queuedLevels + 1;
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
  const queue = state.researchQueue;
  const previousCompletion = queue.length > 0 ? queue[queue.length - 1].completesAt : now;
  queue.push({
    type: 'research',
    id: researchId,
    targetLevel: nextLevel,
    startedAt: previousCompletion,
    completesAt: previousCompletion + duration * 1000,
  });

  return true;
}

export function cancelResearchAtIndex(state: GameState, index: number): void {
  const queue = state.researchQueue;
  if (index < 0 || index >= queue.length) return;

  const selectedItem = queue[index];
  const selectedId = selectedItem.id;
  const selectedTargetLevel = selectedItem.targetLevel ?? 0;
  const removedItems: QueueItem[] = [];
  const keptItems: QueueItem[] = [];

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    if (
      i === index ||
      (i > index &&
        item.id === selectedId &&
        (item.targetLevel ?? 0) > selectedTargetLevel)
    ) {
      removedItems.push(item);
      continue;
    }
    keptItems.push(item);
  }

  for (const item of removedItems) {
    const def = RESEARCH[item.id as ResearchId];
    const cost = researchCostAtLevel(
      def.baseCost,
      def.costMultiplier,
      item.targetLevel!,
    );
    state.planet.resources.metal += cost.metal;
    state.planet.resources.crystal += cost.crystal;
    state.planet.resources.deuterium += cost.deuterium;
  }

  state.researchQueue = keptItems;

  if (index === 0 && state.researchQueue.length > 0) {
    const nextItem = state.researchQueue[0];
    const nextDef = RESEARCH[nextItem.id as ResearchId];
    const nextCost = researchCostAtLevel(
      nextDef.baseCost,
      nextDef.costMultiplier,
      nextItem.targetLevel!,
    );
    const nextDuration = researchTime(
      nextCost.metal,
      nextCost.crystal,
      state.planet.buildings.researchLab,
      state.settings.gameSpeed,
    );
    const now = Date.now();
    nextItem.startedAt = now;
    nextItem.completesAt = now + nextDuration * 1000;
  }
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

export function startDefenceBuild(
  state: GameState,
  defenceId: DefenceId,
  quantity: number,
): boolean {
  if (quantity <= 0) return false;

  const def = DEFENCES[defenceId];
  if (!prerequisitesMet(def.requires, state)) return false;

  if (def.maxCount !== undefined) {
    const currentCount = state.planet.defences[defenceId];
    if (currentCount + quantity > def.maxCount) return false;
  }

  const totalCost: ResourceCost = {
    metal: def.cost.metal * quantity,
    crystal: def.cost.crystal * quantity,
    deuterium: def.cost.deuterium * quantity,
  };
  if (!canAfford(totalCost, state)) return false;

  deductCost(totalCost, state);

  const perUnitSeconds = defenceBuildTime(
    def.structuralIntegrity,
    state.planet.buildings.shipyard,
    state.planet.buildings.naniteFactory,
    state.settings.gameSpeed,
  );

  const now = Date.now();
  state.planet.shipyardQueue.push({
    type: 'defence',
    id: defenceId,
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
  if (state.planet.buildingQueue.length > 0 && now >= state.planet.buildingQueue[0].completesAt) {
    const item = state.planet.buildingQueue[0];
    state.planet.buildings[item.id as BuildingId] = item.targetLevel!;
    state.planet.buildingQueue.shift();

    const nextItem = state.planet.buildingQueue[0];
    if (nextItem) {
      const nextDef = BUILDINGS[nextItem.id as BuildingId];
      const nextCost = buildingCostAtLevel(
        nextDef.baseCost,
        nextDef.costMultiplier,
        nextItem.targetLevel!,
      );
      const nextDuration = buildingTime(
        nextCost.metal,
        nextCost.crystal,
        state.planet.buildings.roboticsFactory,
        state.planet.buildings.naniteFactory,
        state.settings.gameSpeed,
      );
      nextItem.startedAt = now;
      nextItem.completesAt = now + nextDuration * 1000;
    }
  }

  // Research queue
  if (state.researchQueue.length > 0 && now >= state.researchQueue[0].completesAt) {
    const item = state.researchQueue[0];
    state.research[item.id as ResearchId] = item.targetLevel!;
    state.researchQueue.shift();

    const nextItem = state.researchQueue[0];
    if (nextItem) {
      const nextDef = RESEARCH[nextItem.id as ResearchId];
      const nextCost = researchCostAtLevel(
        nextDef.baseCost,
        nextDef.costMultiplier,
        nextItem.targetLevel!,
      );
      const nextDuration = researchTime(
        nextCost.metal,
        nextCost.crystal,
        state.planet.buildings.researchLab,
        state.settings.gameSpeed,
      );
      nextItem.startedAt = now;
      nextItem.completesAt = now + nextDuration * 1000;
    }
  }

  // Shipyard queue (process front item)
  if (state.planet.shipyardQueue.length > 0) {
    const item = state.planet.shipyardQueue[0];
    if (now >= item.completesAt) {
      item.completed = (item.completed ?? 0) + 1;
      if (item.type === 'defence') {
        state.planet.defences[item.id as DefenceId] += 1;
      } else {
        state.planet.ships[item.id as ShipId] += 1;
      }

      if (item.completed >= item.quantity!) {
        // Batch done, remove from queue
        state.planet.shipyardQueue.shift();
      } else {
        // Start next unit
        const perUnitSeconds =
          item.type === 'defence'
            ? defenceBuildTime(
                DEFENCES[item.id as DefenceId].structuralIntegrity,
                state.planet.buildings.shipyard,
                state.planet.buildings.naniteFactory,
                state.settings.gameSpeed,
              )
            : shipBuildTime(
                SHIPS[item.id as ShipId].structuralIntegrity,
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
  if (state.planet.buildingQueue.length > 0) {
    const item = state.planet.buildingQueue[0];
    const remaining = item.completesAt - now;
    if (remaining > 0) {
      item.completesAt = now + remaining * ratio;
    }
  }

  // Research queue
  if (state.researchQueue.length > 0) {
    const item = state.researchQueue[0];
    const remaining = item.completesAt - now;
    if (remaining > 0) {
      item.completesAt = now + remaining * ratio;
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

  events.push(...state.planet.buildingQueue);
  events.push(...state.researchQueue);
  // For shipyard, each remaining unit is an event
  for (const item of state.planet.shipyardQueue) {
    const remaining = (item.quantity ?? 1) - (item.completed ?? 0);
    const perUnitSeconds =
      item.type === 'defence'
        ? defenceBuildTime(
            DEFENCES[item.id as DefenceId].structuralIntegrity,
            state.planet.buildings.shipyard,
            state.planet.buildings.naniteFactory,
            state.settings.gameSpeed,
          )
        : shipBuildTime(
            SHIPS[item.id as ShipId].structuralIntegrity,
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
