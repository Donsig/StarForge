import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import { useGame } from '../context/GameContext';
import type { BuildingId, DefenceId, QueueItem, ResearchId, ShipId } from '../models/types.ts';
import { QueueRow, getQueuedItemDuration } from './QueueRow';

function getShipyardItemName(item: QueueItem): string {
  return item.type === 'defence'
    ? DEFENCES[item.id as DefenceId].name
    : SHIPS[item.id as ShipId].name;
}

export function QueueDisplay() {
  const { gameState, cancelBuilding, cancelResearch, cancelShipyard } = useGame();
  const planet = gameState.planets[gameState.activePlanetIndex];

  const hasBuildingQueue = planet.buildingQueue.length > 0;
  const hasResearchQueue = gameState.researchQueue.length > 0;
  const hasShipyardQueue = planet.shipyardQueue.length > 0;

  if (!hasBuildingQueue && !hasResearchQueue && !hasShipyardQueue) {
    return null;
  }

  return (
    <footer className="queue-bar">
      {planet.buildingQueue.map((item, index) => (
        <QueueRow
          key={`b-${item.id}-${item.targetLevel}-${index}`}
          label={`Building: ${BUILDINGS[item.id as BuildingId].name}`}
          subtitle={`Lv ${item.targetLevel ?? 0}${index > 0 ? ' (queued)' : ''}`}
          completesAt={index === 0 ? item.completesAt : null}
          duration={index > 0 ? getQueuedItemDuration(item) : undefined}
          onCancel={() => cancelBuilding(index)}
        />
      ))}

      {gameState.researchQueue.map((item, index) => (
        <QueueRow
          key={`r-${item.id}-${item.targetLevel}-${index}`}
          label={`Research: ${RESEARCH[item.id as ResearchId].name}`}
          subtitle={`Lv ${item.targetLevel ?? 0}${index > 0 ? ' (queued)' : ''}`}
          completesAt={index === 0 ? item.completesAt : null}
          duration={index > 0 ? getQueuedItemDuration(item) : undefined}
          onCancel={() => cancelResearch(index)}
        />
      ))}

      {planet.shipyardQueue.map((item, index) => {
        const name = getShipyardItemName(item);
        const progress = index === 0
          ? `${(item.completed ?? 0) + 1}/${item.quantity}`
          : `0/${item.quantity}`;
        return (
          <QueueRow
            key={`s-${item.id}-${index}`}
            label={`Shipyard: ${name}`}
            subtitle={`${progress}${index > 0 ? ' (queued)' : ''}`}
            completesAt={index === 0 ? item.completesAt : null}
            duration={index > 0 ? getQueuedItemDuration(item) : undefined}
            onCancel={() => cancelShipyard(index)}
          />
        );
      })}
    </footer>
  );
}
