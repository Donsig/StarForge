import { useRef, useState } from 'react';
import { SHIP_ORDER, SHIPS } from '../data/ships.ts';
import { usedFields } from '../engine/BuildQueue.ts';
import { useGame } from '../context/GameContext';
import { formatNumber, formatRate } from '../utils/format.ts';

export function OverviewPanel() {
  const { gameState, productionRates, renamePlanet } = useGame();
  const activePlanetIndex = gameState.activePlanetIndex;
  const planet = gameState.planets[activePlanetIndex];
  const speed = gameState.settings.gameSpeed;
  const [editingPlanetIndex, setEditingPlanetIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const committedRef = useRef(false);

  const fieldsUsed = usedFields(gameState);
  const editing = editingPlanetIndex === activePlanetIndex;

  const [lastActivePlanetIndex, setLastActivePlanetIndex] = useState(activePlanetIndex);
  if (lastActivePlanetIndex !== activePlanetIndex) {
    setLastActivePlanetIndex(activePlanetIndex);
    if (editingPlanetIndex !== null) {
      setEditingPlanetIndex(null);
      setDraft('');
    }
  }

  const totalResearchLevels = Object.values(gameState.research).reduce(
    (sum, level) => sum + level,
    0,
  );
  const researchedTechnologies = Object.values(gameState.research).filter(
    (level) => level > 0,
  ).length;

  let totalShips = 0;
  let totalFleetPower = 0;

  for (const shipId of SHIP_ORDER) {
    const count = planet.ships[shipId];
    totalShips += count;
    totalFleetPower += count * SHIPS[shipId].weaponPower;
  }

  const startEditing = () => {
    committedRef.current = false;
    setDraft(planet.name);
    setEditingPlanetIndex(activePlanetIndex);
  };

  const commit = () => {
    if (committedRef.current || editingPlanetIndex !== activePlanetIndex) {
      return;
    }

    committedRef.current = true;
    renamePlanet(activePlanetIndex, draft);
    setEditingPlanetIndex(null);
    setDraft('');
  };

  const cancel = () => {
    committedRef.current = false;
    setEditingPlanetIndex(null);
    setDraft('');
  };

  return (
    <section className="panel">
      <h1 className="panel-title">Planet Overview</h1>

      <div className="stat-grid">
        <article className="panel-card">
          <h2 className="section-title">Colony Status</h2>
          <p className="stat-line">
            <span className="label">Name</span>
            {editing ? (
              <input
                type="text"
                className="input planet-rename-input"
                value={draft}
                maxLength={30}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commit();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancel();
                  }
                }}
                onBlur={commit}
                aria-label="Planet name"
              />
            ) : (
              <>
                <span>{planet.name}</span>
                <button
                  type="button"
                  className="btn btn-sm planet-rename-btn"
                  aria-label="Rename planet"
                  onClick={startEditing}
                >
                  ✏
                </button>
              </>
            )}
          </p>
          <p className="stat-line">
            <span className="label">Temperature</span>
            <span className="number">{planet.maxTemperature}&deg;C</span>
          </p>
          <p className="stat-line">
            <span className="label">Fields</span>
            <span className="number">
              {fieldsUsed} / {planet.maxFields}
            </span>
          </p>
        </article>

        <article className="panel-card">
          <h2 className="section-title">Production</h2>
          <p className="stat-line">
            <span className="label">Metal</span>
            <span className="number">{formatRate(productionRates.metalPerHour * speed)}</span>
          </p>
          <p className="stat-line">
            <span className="label">Crystal</span>
            <span className="number">{formatRate(productionRates.crystalPerHour * speed)}</span>
          </p>
          <p className="stat-line">
            <span className="label">Deuterium</span>
            <span className="number">{formatRate(productionRates.deuteriumPerHour * speed)}</span>
          </p>
          <p className="stat-line">
            <span className="label">Energy</span>
            <span className="number">
              {formatNumber(productionRates.energyProduction)} /{' '}
              {formatNumber(productionRates.energyConsumption)}
            </span>
          </p>
        </article>

        <article className="panel-card">
          <h2 className="section-title">Research Command</h2>
          <p className="stat-line">
            <span className="label">Technologies Researched</span>
            <span className="number">{researchedTechnologies}</span>
          </p>
          <p className="stat-line">
            <span className="label">Total Research Levels</span>
            <span className="number">{totalResearchLevels}</span>
          </p>
          <p className="stat-line">
            <span className="label">Active Queue</span>
            <span>{gameState.researchQueue.length > 0 ? 'Research in progress' : 'Idle'}</span>
          </p>
        </article>

        <article className="panel-card">
          <h2 className="section-title">Fleet Status</h2>
          <p className="stat-line">
            <span className="label">Ships</span>
            <span className="number">{formatNumber(totalShips)}</span>
          </p>
          <p className="stat-line">
            <span className="label">Fleet Power</span>
            <span className="number">{formatNumber(totalFleetPower)}</span>
          </p>
          <p className="stat-line">
            <span className="label">Shipyard Queue</span>
            <span className="number">{planet.shipyardQueue.length}</span>
          </p>
        </article>
      </div>
    </section>
  );
}
