import { useLayoutEffect, useRef } from 'react';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import { useGame } from '../context/GameContext';
import type {
  ActivePanel,
  BuildingId,
  DefenceId,
  QueueItem,
  ResearchId,
  ShipId,
} from '../models/types.ts';
import { QueueRow, getQueuedItemDuration } from './QueueRow';

function getShipyardItemName(item: QueueItem): string {
  return item.type === 'defence'
    ? DEFENCES[item.id as DefenceId].name
    : SHIPS[item.id as ShipId].name;
}

interface QueueDisplayProps {
  activePanel: ActivePanel;
}

function getQueueDurationMs(item: QueueItem): number {
  return Math.max(0, item.completesAt - item.startedAt);
}

export function QueueDisplay({ activePanel }: QueueDisplayProps) {
  const { gameState, cancelBuilding, cancelResearch, cancelShipyard } = useGame();
  const planet = gameState.planets[gameState.activePlanetIndex];
  const barRef = useRef<HTMLElement>(null);

  const showBuildingQueue = activePanel !== 'buildings';
  const showResearchQueue = activePanel !== 'research';
  const showShipyardQueue = activePanel !== 'shipyard';

  const hasVisibleQueueItems =
    (showBuildingQueue && planet.buildingQueue.length > 0) ||
    (showResearchQueue && gameState.researchQueue.length > 0) ||
    (showShipyardQueue && planet.shipyardQueue.length > 0);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!hasVisibleQueueItems || !bar) {
      document.documentElement.style.setProperty('--queue-bar-height', '0px');
      return;
    }

    const setBarHeight = () => {
      document.documentElement.style.setProperty(
        '--queue-bar-height',
        `${bar.offsetHeight}px`,
      );
    };

    if (typeof ResizeObserver === 'undefined') {
      setBarHeight();

      return () => {
        document.documentElement.style.setProperty('--queue-bar-height', '0px');
      };
    }

    const observer = new ResizeObserver(() => {
      setBarHeight();
    });
    observer.observe(bar);
    setBarHeight();

    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--queue-bar-height', '0px');
    };
  }, [hasVisibleQueueItems]);

  if (!hasVisibleQueueItems) {
    return null;
  }

  return (
    <footer ref={barRef} className="queue-bar">
      {showBuildingQueue && planet.buildingQueue.map((item, index) => (
        <QueueRow
          key={`b-${item.id}-${item.targetLevel}-${index}`}
          label={`Building: ${BUILDINGS[item.id as BuildingId].name}`}
          subtitle={`Lv ${item.targetLevel ?? 0}${index > 0 ? ' (queued)' : ''}`}
          completesAt={index === 0 ? item.completesAt : null}
          duration={index > 0 ? getQueuedItemDuration(item) : undefined}
          startedAt={item.startedAt}
          totalDurationMs={getQueueDurationMs(item)}
          onCancel={() => cancelBuilding(index)}
        />
      ))}

      {showResearchQueue && gameState.researchQueue.map((item, index) => (
        <QueueRow
          key={`r-${item.id}-${item.targetLevel}-${index}`}
          label={`Research: ${RESEARCH[item.id as ResearchId].name}`}
          subtitle={`Lv ${item.targetLevel ?? 0}${index > 0 ? ' (queued)' : ''}`}
          completesAt={index === 0 ? item.completesAt : null}
          duration={index > 0 ? getQueuedItemDuration(item) : undefined}
          startedAt={item.startedAt}
          totalDurationMs={getQueueDurationMs(item)}
          onCancel={() => cancelResearch(index)}
        />
      ))}

      {showShipyardQueue && planet.shipyardQueue.map((item, index) => {
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
            startedAt={item.startedAt}
            totalDurationMs={getQueueDurationMs(item)}
            onCancel={() => cancelShipyard(index)}
          />
        );
      })}
    </footer>
  );
}
