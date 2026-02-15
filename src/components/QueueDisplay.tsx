import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import { useGame } from '../context/GameContext';
import { useCountdown } from '../hooks/useCountdown';
import type { BuildingId, DefenceId, ResearchId, ShipId } from '../models/types.ts';

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
      <div className="queue-time number">{countdown}</div>
      {onCancel && (
        <button type="button" className="btn btn-danger" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

export function QueueDisplay() {
  const { gameState, cancelBuilding, cancelResearch } = useGame();

  const buildingQueue = gameState.planet.buildingQueue[0] ?? null;
  const researchQueue = gameState.researchQueue[0] ?? null;
  const currentShipBatch = gameState.planet.shipyardQueue[0] ?? null;

  if (!buildingQueue && !researchQueue && !currentShipBatch) {
    return null;
  }

  const shipBatchesQueuedBehind = Math.max(gameState.planet.shipyardQueue.length - 1, 0);
  const currentShipyardName = currentShipBatch
    ? currentShipBatch.type === 'defence'
      ? DEFENCES[currentShipBatch.id as DefenceId].name
      : SHIPS[currentShipBatch.id as ShipId].name
    : '';

  return (
    <footer className="queue-bar">
      {buildingQueue && (
        <QueueRow
          label={`Building: ${BUILDINGS[buildingQueue.id as BuildingId].name}`}
          subtitle={`Target level ${buildingQueue.targetLevel ?? 0}`}
          completesAt={buildingQueue.completesAt}
          onCancel={cancelBuilding}
        />
      )}

      {researchQueue && (
        <QueueRow
          label={`Research: ${RESEARCH[researchQueue.id as ResearchId].name}`}
          subtitle={`Target level ${researchQueue.targetLevel ?? 0}`}
          completesAt={researchQueue.completesAt}
          onCancel={cancelResearch}
        />
      )}

      {currentShipBatch && (
        <QueueRow
          label={`Shipyard: ${currentShipyardName}`}
          subtitle={`Unit ${(currentShipBatch.completed ?? 0) + 1}/${currentShipBatch.quantity ?? 0}${
            shipBatchesQueuedBehind > 0 ? `, +${shipBatchesQueuedBehind} queued batch(es)` : ''
          }`}
          completesAt={currentShipBatch.completesAt}
        />
      )}
    </footer>
  );
}
