import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { HoverPortal } from './HoverPortal';
import {
  solarPlantEnergy,
  fusionReactorEnergy,
  metalMineEnergy,
  crystalMineEnergy,
  deuteriumSynthEnergy,
} from '../engine/FormulasEngine.ts';
import { formatNumber, formatRate } from '../utils/format.ts';

const HOVER_CLOSE_DELAY_MS = 120;

export function ResourceBar() {
  const [hovered, setHovered] = useState(false);
  const energyRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const { gameState, productionRates, storageCaps } = useGame();
  const planet = gameState.planets[gameState.activePlanetIndex];
  const { resources, buildings } = planet;
  const speed = gameState.settings.gameSpeed;
  const energyOk = productionRates.energyProduction >= productionRates.energyConsumption;
  const metalNearCap = resources.metal > storageCaps.metal * 0.9;
  const crystalNearCap = resources.crystal > storageCaps.crystal * 0.9;
  const deuteriumNearCap = resources.deuterium > storageCaps.deuterium * 0.9;
  const energyTechLevel = gameState.research.energyTechnology;
  const satelliteCount = Math.max(0, planet.ships.solarSatellite ?? 0);
  const perSatEnergy = Number.isFinite(planet.maxTemperature)
    ? Math.max(0, Math.floor((planet.maxTemperature + 140) / 6))
    : 0;
  const satelliteEnergy = Math.floor(satelliteCount * perSatEnergy);

  const productionRows = [
    { label: `Solar Plant (Lv ${buildings.solarPlant})`, value: Math.floor(solarPlantEnergy(buildings.solarPlant)) },
    {
      label: `Fusion Reactor (Lv ${buildings.fusionReactor})`,
      value: Math.floor(fusionReactorEnergy(buildings.fusionReactor, energyTechLevel)),
    },
  ].filter((row) => row.value > 0);

  const consumptionRows = [
    { label: 'Metal Mine', value: Math.floor(metalMineEnergy(buildings.metalMine)) },
    { label: 'Crystal Mine', value: Math.floor(crystalMineEnergy(buildings.crystalMine)) },
    {
      label: 'Deuterium Synth',
      value: Math.floor(deuteriumSynthEnergy(buildings.deuteriumSynthesizer)),
    },
  ].filter((row) => row.value > 0);

  const totalProduction =
    productionRows.reduce((sum, row) => sum + row.value, 0) + satelliteEnergy;
  const totalConsumption = consumptionRows.reduce((sum, row) => sum + row.value, 0);
  const netBalance = totalProduction - totalConsumption;

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const openHover = () => {
    clearHoverCloseTimer();
    setHovered(true);
  };

  const scheduleHoverClose = () => {
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setHovered(false);
      hoverCloseTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (hoverCloseTimerRef.current !== null) {
        window.clearTimeout(hoverCloseTimerRef.current);
        hoverCloseTimerRef.current = null;
      }
    },
    [],
  );

  return (
    <header className="resource-bar">
      <div className="resource-entry">
        <span className="resource-dot dot-metal" />
        <div>
          <div className="resource-label">Metal</div>
          <div
            className={
              metalNearCap
                ? 'resource-value number resource-near-cap'
                : 'resource-value number'
            }
          >
            {formatNumber(resources.metal)} / {formatNumber(storageCaps.metal)}
          </div>
          <div className="resource-rate number">{formatRate(productionRates.metalPerHour * speed)}</div>
        </div>
      </div>

      <div className="resource-entry">
        <span className="resource-dot dot-crystal" />
        <div>
          <div className="resource-label">Crystal</div>
          <div
            className={
              crystalNearCap
                ? 'resource-value number resource-near-cap'
                : 'resource-value number'
            }
          >
            {formatNumber(resources.crystal)} / {formatNumber(storageCaps.crystal)}
          </div>
          <div className="resource-rate number">{formatRate(productionRates.crystalPerHour * speed)}</div>
        </div>
      </div>

      <div className="resource-entry">
        <span className="resource-dot dot-deuterium" />
        <div>
          <div className="resource-label">Deuterium</div>
          <div
            className={
              deuteriumNearCap
                ? 'resource-value number resource-near-cap'
                : 'resource-value number'
            }
          >
            {formatNumber(resources.deuterium)} / {formatNumber(storageCaps.deuterium)}
          </div>
          <div className="resource-rate number">{formatRate(productionRates.deuteriumPerHour * speed)}</div>
        </div>
      </div>

      <div
        ref={energyRef}
        className="resource-entry"
        onMouseEnter={openHover}
        onMouseLeave={scheduleHoverClose}
      >
        <span className="resource-dot dot-energy" />
        <div>
          <div className="resource-label">Energy</div>
          <div className={`resource-value number ${energyOk ? 'energy-ok' : 'energy-deficit'}`}>
            {formatNumber(productionRates.energyProduction)} /{' '}
            {formatNumber(productionRates.energyConsumption)}
          </div>
          <div className="resource-rate">production / consumption</div>
        </div>
        <HoverPortal
          anchorRef={energyRef}
          open={hovered}
          align="below-right"
          className="energy-hover-panel"
          onMouseEnter={openHover}
          onMouseLeave={scheduleHoverClose}
        >
            <div className="resource-label">Production</div>
            {productionRows.map((row) => (
              <div key={row.label} className="energy-hover-row">
                <span>{row.label}</span>
                <span className="number">{formatNumber(row.value)} EU</span>
              </div>
            ))}
            <div className="energy-hover-row">
              <span>{`Solar Satellites (${satelliteCount})`}</span>
              <span className="number">{formatNumber(satelliteEnergy)} EU</span>
            </div>
            <div className="resource-label" style={{ marginTop: '0.5rem' }}>
              Consumption
            </div>
            {consumptionRows.map((row) => (
              <div key={row.label} className="energy-hover-row">
                <span>{row.label}</span>
                <span className="number">{formatNumber(row.value)} EU</span>
              </div>
            ))}
            <div
              className="energy-hover-row"
              style={{
                marginTop: '0.5rem',
                paddingTop: '0.4rem',
                borderTop: '1px solid rgba(30, 45, 74, 0.55)',
              }}
            >
              <span>Net balance</span>
              <span
                className="number"
                style={{ color: netBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}
              >
                {`${netBalance >= 0 ? '+' : ''}${formatNumber(netBalance)} EU`}
              </span>
            </div>
        </HoverPortal>
      </div>
    </header>
  );
}
