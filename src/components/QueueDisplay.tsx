import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import { useGame } from '../context/GameContext';
import { useCountdown } from '../hooks/useCountdown';
import type { BuildingId, DefenceId, QueueItem, ResearchId, ShipId } from '../models/types.ts';

interface QueueRowProps {
  label: string;
  subtitle: string;
  completesAt: number | null;
  onCancel?: () => void;
}

function QueueRow({ label, subtitle, completesAt, onCancel }: QueueRowProps) {
  const countdown = useCountdown(completesAt);

  return (
    <div className="queue-item">
      <div className="queue-main">
        <div className="queue-label">{label}</div>
        <div className="queue-subtitle">{subtitle}</div>
      </div>
      {countdown && <div className="queue-time number">{countdown}</div>}
      {onCancel && (
        <button type="button" className="btn btn-danger" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

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
          onCancel={() => cancelBuilding(index)}
        />
      ))}

      {gameState.researchQueue.map((item, index) => (
        <QueueRow
          key={`r-${item.id}-${item.targetLevel}-${index}`}
          label={`Research: ${RESEARCH[item.id as ResearchId].name}`}
          subtitle={`Lv ${item.targetLevel ?? 0}${index > 0 ? ' (queued)' : ''}`}
          completesAt={index === 0 ? item.completesAt : null}
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
            onCancel={() => cancelShipyard(index)}
          />
        );
      })}
    </footer>
  );
}
