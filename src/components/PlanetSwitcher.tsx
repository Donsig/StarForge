import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { getPlanetImageUrl } from '../data/assets.ts';

export function PlanetSwitcher() {
  const { gameState, setActivePlanet } = useGame();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activePlanet = gameState.planets[gameState.activePlanetIndex];
  const activeCoords = activePlanet.coordinates;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [open]);

  return (
    <div ref={rootRef} className="planet-switcher">
      <button
        type="button"
        className="planet-switcher__btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <img
          src={getPlanetImageUrl(activePlanet.maxTemperature, 'icon')}
          alt=""
          className="planet-switcher__icon planet-switcher__icon--sm"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <span className="planet-switcher__summary">
          <span className="planet-switcher__name">{activePlanet.name}</span>
          <span className="planet-switcher__coords">
            [{activeCoords.galaxy}:{activeCoords.system}:{activeCoords.slot}]
          </span>
        </span>
        <span className="planet-switcher__chevron" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="planet-switcher__dropdown" role="listbox">
          {gameState.planets.map((planet, index) => {
            const isActive = index === gameState.activePlanetIndex;
            const fieldsUsed = Object.values(planet.buildings).reduce(
              (total, level) => total + level,
              0,
            );

            return (
              <button
                key={`${planet.coordinates.galaxy}:${planet.coordinates.system}:${planet.coordinates.slot}`}
                type="button"
                className={`planet-switcher__item${isActive ? ' is-active' : ''}`}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setActivePlanet(index);
                  setOpen(false);
                }}
              >
                <img
                  src={getPlanetImageUrl(planet.maxTemperature, 'icon')}
                  alt=""
                  className="planet-switcher__icon planet-switcher__icon--md"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <span className="planet-switcher__details">
                  <span className="planet-switcher__item-name">{planet.name}</span>
                  <span className="planet-switcher__meta">
                    [{planet.coordinates.galaxy}:{planet.coordinates.system}:{planet.coordinates.slot}]
                    {' '}· {fieldsUsed}/{planet.maxFields} fields
                  </span>
                </span>
                <span className="planet-switcher__indicator" aria-hidden="true">
                  {isActive ? '●' : ''}
                </span>
              </button>
            );
          })}
          <div className="planet-switcher__footer">
            Build Colony Ship to expand
          </div>
        </div>
      )}
    </div>
  );
}
