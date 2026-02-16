import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { GALAXY_CONSTANTS } from '../data/galaxy.ts';
import { getSystemSlots, canColonize, type SystemSlot } from '../engine/GalaxyEngine.ts';

export function GalaxyPanel() {
  const { gameState, colonizeAction } = useGame();
  const [currentSystem, setCurrentSystem] = useState(
    gameState.planets[gameState.activePlanetIndex].coordinates.system,
  );

  const slots = getSystemSlots(gameState, 1, currentSystem);
  const hasColonyShip = canColonize(gameState);

  return (
    <section className="panel">
      <h1 className="panel-title">Galaxy</h1>
      <p className="panel-subtitle">
        Explore the galaxy, find empty slots, and colonize new worlds.
      </p>

      <div className="galaxy-nav">
        <button
          type="button"
          className="btn btn-primary"
          disabled={currentSystem <= 1}
          onClick={() => setCurrentSystem((s) => Math.max(1, s - 1))}
        >
          Prev
        </button>
        <span className="galaxy-system-label">
          <span className="galaxy-system-prefix">Galaxy 1</span>
          <span className="galaxy-system-number number">
            System {currentSystem}
          </span>
          <span className="galaxy-system-total number">
            / {GALAXY_CONSTANTS.MAX_SYSTEMS}
          </span>
        </span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={currentSystem >= GALAXY_CONSTANTS.MAX_SYSTEMS}
          onClick={() =>
            setCurrentSystem((s) => Math.min(GALAXY_CONSTANTS.MAX_SYSTEMS, s + 1))
          }
        >
          Next
        </button>
      </div>

      <div className="table-wrap">
        <table className="galaxy-table">
          <thead>
            <tr>
              <th>Slot</th>
              <th>Status</th>
              <th>Name</th>
              <th>Details</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, index) => (
              <GalaxySlotRow
                key={index}
                slot={slot}
                slotNumber={index + 1}
                system={currentSystem}
                hasColonyShip={hasColonyShip}
                onColonize={colonizeAction}
              />
            ))}
          </tbody>
        </table>
      </div>

      {!hasColonyShip && (
        <p className="hint galaxy-hint">
          Build a Colony Ship in the Shipyard to colonize empty slots.
        </p>
      )}
    </section>
  );
}

function GalaxySlotRow({
  slot,
  slotNumber,
  system,
  hasColonyShip,
  onColonize,
}: {
  slot: SystemSlot;
  slotNumber: number;
  system: number;
  hasColonyShip: boolean;
  onColonize: (coords: { galaxy: number; system: number; slot: number }) => boolean;
}) {
  return (
    <tr className={`galaxy-row-${slot.type}`}>
      <td className="number">[1:{system}:{slotNumber}]</td>
      <td>
        {slot.type === 'player' && (
          <span className="galaxy-badge galaxy-badge-player">You</span>
        )}
        {slot.type === 'npc' && (
          <span className="galaxy-badge galaxy-badge-npc">NPC</span>
        )}
        {slot.type === 'empty' && (
          <span className="galaxy-badge galaxy-badge-empty">Empty</span>
        )}
      </td>
      <td>
        {slot.type === 'player' && slot.planet?.name}
        {slot.type === 'npc' && slot.npc?.name}
        {slot.type === 'empty' && (
          <span className="galaxy-uninhabited">Uninhabited</span>
        )}
      </td>
      <td>
        {slot.type === 'npc' && (
          <span className="galaxy-strength number">Strength {slot.npc?.strength}</span>
        )}
      </td>
      <td>
        {slot.type === 'empty' && hasColonyShip && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onColonize({ galaxy: 1, system, slot: slotNumber })}
          >
            Colonize
          </button>
        )}
      </td>
    </tr>
  );
}
