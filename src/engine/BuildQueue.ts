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
import { activePlanet } from './helpers.ts';

export function effectiveResearchLabLevel(state: GameState, item: QueueItem): number {
  const irnLevel = (state.research as Record<string, number>).intergalacticResearchNetwork ?? 0;
  if (irnLevel === 0 || state.planets.length <= 1) {
    const sourcePlanet =
      state.planets[item.sourcePlanetIndex ?? state.activePlanetIndex] ??
      state.planets[state.activePlanetIndex] ??
      state.planets[0];
    return sourcePlanet?.buildings.researchLab ?? 0;
  }

  return state.planets
    .map((planet) => planet.buildings.researchLab)
    .sort((a, b) => b - a)
    .slice(0, irnLevel + 1)
    .reduce((sum, labLevel) => sum + labLevel, 0);
}

// ── Prerequisite checking ───────────────────────────────────────

export function prerequisitesMet(
  requires: { type: 'building' | 'research'; id: string; level: number }[],
  state: GameState,
): boolean {
  const planet = activePlanet(state);
  for (const req of requires) {
    if (req.type === 'building') {
      const level = planet.buildings[req.id as BuildingId];
      if (level === undefined || level < req.level) return false;
    } else {
      const level = state.research[req.id as ResearchId];
      if (level === undefined || level < req.level) return false;
    }
  }
  return true;
}

export function canAfford(cost: ResourceCost, state: GameState): boolean {
  const planet = activePlanet(state);
  const res = planet.resources;
  return (
    res.metal >= cost.metal &&
    res.crystal >= cost.crystal &&
    res.deuterium >= cost.deuterium
  );
}

function deductCost(cost: ResourceCost, state: GameState): void {
  const planet = activePlanet(state);
  planet.resources.metal -= cost.metal;
  planet.resources.crystal -= cost.crystal;
  planet.resources.deuterium -= cost.deuterium;
}

// ── Used building fields count ──────────────────────────────────

export function usedFields(state: GameState): number {
  const planet = activePlanet(state);
  let total = 0;
  for (const level of Object.values(planet.buildings)) {
    total += level;
  }
  return total;
}

// ── Building queue ──────────────────────────────────────────────

export function startBuildingUpgrade(
  state: GameState,
  buildingId: BuildingId,
): boolean {
  const planet = activePlanet(state);
  const def = BUILDINGS[buildingId];
  const currentLevel = planet.buildings[buildingId];
  const queuedLevels = planet.buildingQueue.filter(
    (item) => item.id === buildingId,
  ).length;
  const nextLevel = currentLevel + queuedLevels + 1;
  const cost = buildingCostAtLevel(def.baseCost, def.costMultiplier, nextLevel);

  if (!canAfford(cost, state)) return false;
  if (!prerequisitesMet(def.requires, state)) return false;
  if (usedFields(state) + planet.buildingQueue.length >= planet.maxFields) {
    return false;
  }

  deductCost(cost, state);

  const duration = buildingTime(
    cost.metal,
    cost.crystal,
    planet.buildings.roboticsFactory,
    planet.buildings.naniteFactory,
    state.settings.gameSpeed,
  );

  const now = Date.now();
  const queue = planet.buildingQueue;
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
  const planet = activePlanet(state);
  const queue = planet.buildingQueue;
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
    planet.resources.metal += cost.metal;
    planet.resources.crystal += cost.crystal;
    planet.resources.deuterium += cost.deuterium;
  }

  planet.buildingQueue = keptItems;

  if (index === 0 && planet.buildingQueue.length > 0) {
    const nextItem = planet.buildingQueue[0];
    const nextDef = BUILDINGS[nextItem.id as BuildingId];
    const nextCost = buildingCostAtLevel(
      nextDef.baseCost,
      nextDef.costMultiplier,
      nextItem.targetLevel!,
    );
    const nextDuration = buildingTime(
      nextCost.metal,
      nextCost.crystal,
      planet.buildings.roboticsFactory,
      planet.buildings.naniteFactory,
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
  const planet = activePlanet(state);
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

  const tempItem: QueueItem = {
    type: 'research',
    id: researchId,
    targetLevel: nextLevel,
    sourcePlanetIndex: state.activePlanetIndex,
    startedAt: 0,
    completesAt: 0,
  };
  const duration = researchTime(
    cost.metal,
    cost.crystal,
    effectiveResearchLabLevel(state, tempItem),
    state.settings.gameSpeed,
  );

  const now = Date.now();
  const queue = state.researchQueue;
  const previousCompletion = queue.length > 0 ? queue[queue.length - 1].completesAt : now;
  queue.push({
    type: 'research',
    id: researchId,
    targetLevel: nextLevel,
    sourcePlanetIndex: state.activePlanetIndex,
    startedAt: previousCompletion,
    completesAt: previousCompletion + duration * 1000,
  });

  return true;
}

export function cancelResearchAtIndex(state: GameState, index: number): void {
  const planet = activePlanet(state);
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
    planet.resources.metal += cost.metal;
    planet.resources.crystal += cost.crystal;
    planet.resources.deuterium += cost.deuterium;
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
      effectiveResearchLabLevel(state, nextItem),
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
  const planet = activePlanet(state);
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
    planet.buildings.shipyard,
    planet.buildings.naniteFactory,
    state.settings.gameSpeed,
  );

  const now = Date.now();
  planet.shipyardQueue.push({
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
  const planet = activePlanet(state);
  if (quantity <= 0) return false;

  const def = DEFENCES[defenceId];
  if (!prerequisitesMet(def.requires, state)) return false;

  if (def.maxCount !== undefined) {
    const currentCount = planet.defences[defenceId];
    const queuedCount = planet.shipyardQueue.reduce((total, item) => {
      if (item.type !== 'defence' || item.id !== defenceId) {
        return total;
      }
      const quantityValue = Math.max(0, Math.floor(item.quantity ?? 0));
      const completedValue = Math.max(0, Math.floor(item.completed ?? 0));
      return total + Math.max(0, quantityValue - completedValue);
    }, 0);
    if (currentCount + queuedCount + quantity > def.maxCount) return false;
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
    planet.buildings.shipyard,
    planet.buildings.naniteFactory,
    state.settings.gameSpeed,
  );

  const now = Date.now();
  planet.shipyardQueue.push({
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

export function cancelShipyardAtIndex(state: GameState, index: number): void {
  const planet = activePlanet(state);
  const queue = planet.shipyardQueue;
  if (index < 0 || index >= queue.length) return;

  const [item] = queue.splice(index, 1);
  const quantity = item.quantity ?? 0;
  const completed = item.completed ?? 0;
  const refundableUnits = index === 0 ? Math.max(0, quantity - completed) : quantity;
  const unitCost =
    item.type === 'ship'
      ? SHIPS[item.id as ShipId].cost
      : DEFENCES[item.id as DefenceId].cost;

  planet.resources.metal += unitCost.metal * refundableUnits;
  planet.resources.crystal += unitCost.crystal * refundableUnits;
  planet.resources.deuterium += unitCost.deuterium * refundableUnits;

  // Start the next batch if we canceled the front item
  if (index === 0 && queue.length > 0) {
    const nextItem = queue[0];
    const now = Date.now();
    const perUnitSeconds =
      nextItem.type === 'defence'
        ? defenceBuildTime(
            DEFENCES[nextItem.id as DefenceId].structuralIntegrity,
            planet.buildings.shipyard,
            planet.buildings.naniteFactory,
            state.settings.gameSpeed,
          )
        : shipBuildTime(
            SHIPS[nextItem.id as ShipId].structuralIntegrity,
            planet.buildings.shipyard,
            planet.buildings.naniteFactory,
            state.settings.gameSpeed,
          );
    nextItem.startedAt = now;
    nextItem.completesAt = now + perUnitSeconds * 1000;
  }
}

export function processTick(state: GameState, now: number = Date.now()): void {
  for (const planet of state.planets) {
    // Building queue
    if (planet.buildingQueue.length > 0 && now >= planet.buildingQueue[0].completesAt) {
      const item = planet.buildingQueue[0];
      planet.buildings[item.id as BuildingId] = item.targetLevel!;
      planet.buildingQueue.shift();

      const nextItem = planet.buildingQueue[0];
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
          planet.buildings.roboticsFactory,
          planet.buildings.naniteFactory,
          state.settings.gameSpeed,
        );
        nextItem.startedAt = now;
        nextItem.completesAt = now + nextDuration * 1000;
      }
    }

    // Shipyard queue (process front item)
    if (planet.shipyardQueue.length > 0) {
      const item = planet.shipyardQueue[0];
      if (now >= item.completesAt) {
        item.completed = (item.completed ?? 0) + 1;
        if (item.type === 'defence') {
          planet.defences[item.id as DefenceId] += 1;
        } else {
          planet.ships[item.id as ShipId] += 1;
        }

        if (item.completed >= item.quantity!) {
          // Batch done, remove from queue
          planet.shipyardQueue.shift();
        } else {
          // Start next unit
          const perUnitSeconds =
            item.type === 'defence'
              ? defenceBuildTime(
                  DEFENCES[item.id as DefenceId].structuralIntegrity,
                  planet.buildings.shipyard,
                  planet.buildings.naniteFactory,
                  state.settings.gameSpeed,
                )
              : shipBuildTime(
                  SHIPS[item.id as ShipId].structuralIntegrity,
                  planet.buildings.shipyard,
                  planet.buildings.naniteFactory,
                  state.settings.gameSpeed,
                );
          item.completesAt = now + perUnitSeconds * 1000;
        }
      }
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
        effectiveResearchLabLevel(state, nextItem),
        state.settings.gameSpeed,
      );
      nextItem.startedAt = now;
      nextItem.completesAt = now + nextDuration * 1000;
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

  // Building and shipyard queues (front item only) on all planets
  for (const planet of state.planets) {
    if (planet.buildingQueue.length > 0) {
      const item = planet.buildingQueue[0];
      const remaining = item.completesAt - now;
      if (remaining > 0) {
        item.completesAt = now + remaining * ratio;
      }
    }

    if (planet.shipyardQueue.length > 0) {
      const item = planet.shipyardQueue[0];
      const remaining = item.completesAt - now;
      if (remaining > 0) {
        item.completesAt = now + remaining * ratio;
      }
    }
  }

  // Research queue (global front item only)
  if (state.researchQueue.length > 0) {
    const item = state.researchQueue[0];
    const remaining = item.completesAt - now;
    if (remaining > 0) {
      item.completesAt = now + remaining * ratio;
    }
  }
}

/** Get all queue completion events sorted chronologically (for offline catch-up) */
export interface CompletionEvent extends QueueItem {
  planetIndex?: number;
}

export function getCompletionEvents(state: GameState): CompletionEvent[] {
  const events: CompletionEvent[] = [];

  for (let planetIndex = 0; planetIndex < state.planets.length; planetIndex += 1) {
    const planet = state.planets[planetIndex];

    events.push(
      ...planet.buildingQueue.map((item) => ({
        ...item,
        planetIndex,
      })),
    );

    // For shipyard, each remaining unit is an event
    for (const item of planet.shipyardQueue) {
      const remaining = (item.quantity ?? 1) - (item.completed ?? 0);
      const perUnitSeconds =
        item.type === 'defence'
          ? defenceBuildTime(
              DEFENCES[item.id as DefenceId].structuralIntegrity,
              planet.buildings.shipyard,
              planet.buildings.naniteFactory,
              state.settings.gameSpeed,
            )
          : shipBuildTime(
              SHIPS[item.id as ShipId].structuralIntegrity,
              planet.buildings.shipyard,
              planet.buildings.naniteFactory,
              state.settings.gameSpeed,
            );
      let nextCompletion = item.completesAt;
      for (let i = 0; i < remaining; i++) {
        events.push({
          ...item,
          planetIndex,
          completesAt: nextCompletion,
          completed: (item.completed ?? 0) + i,
        });
        nextCompletion += perUnitSeconds * 1000;
      }
    }
  }

  events.push(...state.researchQueue.map((item) => ({ ...item })));
  events.sort((a, b) => a.completesAt - b.completesAt);
  return events;
}
