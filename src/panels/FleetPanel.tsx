import { useEffect, useMemo, useState } from 'react';
import type { FleetMission, MissionType } from '../models/Fleet.ts';
import { SHIP_ORDER, SHIPS } from '../data/ships.ts';
import { DEFENCES } from '../data/defences.ts';
import { useGame } from '../context/GameContext';
import {
  calcCargoCapacity,
  calcDistance,
  calcFleetSpeed,
  calcFuelCost,
  calcMaxFleetSlots,
  calcTravelSeconds,
} from '../engine/FleetEngine.ts';
import { useCountdown } from '../hooks/useCountdown.ts';
import { formatNumber } from '../utils/format.ts';
import { formatDuration } from '../utils/time.ts';

const ESPIONAGE_MAX_TRAVEL_SECONDS = 10;
const ESPIONAGE_MIN_FUEL_COST = 1;

function formatTargetLabel(coords: { galaxy: number; system: number; slot: number }): string {
  return `[G:${coords.galaxy} S:${coords.system} P:${coords.slot}]`;
}

function formatEta(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatMissionType(type: MissionType): string {
  if (type === 'espionage') {
    return 'Espionage';
  }
  if (type === 'harvest') {
    return 'Harvest';
  }
  if (type === 'transport') {
    return 'Transport';
  }
  return 'Attack';
}

function formatCargo(cargo: { metal: number; crystal: number; deuterium: number }): string {
  return `M ${formatNumber(cargo.metal)}  C ${formatNumber(cargo.crystal)}  D ${formatNumber(cargo.deuterium)}`;
}

function missionShipManifest(ships: Record<string, number>): string {
  return Object.entries(ships)
    .map(([shipId, countValue]) => {
      const count = Math.max(0, Math.floor(countValue ?? 0));
      if (count <= 0) return null;
      const shipName = SHIPS[shipId as keyof typeof SHIPS]?.name ?? shipId;
      return `${count}× ${shipName}`;
    })
    .filter((entry): entry is string => entry !== null)
    .join(', ');
}

interface MissionRowProps {
  mission: FleetMission;
  onRecall: (missionId: string) => void;
  onResolve: (missionId: string) => void;
  godMode: boolean;
}

function MissionRow({ mission, onRecall, onResolve, godMode }: MissionRowProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const nextTransition =
    mission.status === 'outbound'
      ? mission.arrivalTime
      : mission.status === 'returning'
        ? mission.returnTime
        : null;
  const countdown = useCountdown(nextTransition && nextTransition > 0 ? nextTransition : null);
  const statusLabel =
    mission.status === 'outbound'
      ? 'Outbound'
      : mission.status === 'returning'
        ? 'Returning'
        : mission.status === 'at_target'
          ? 'At Target'
          : 'Completed';
  const hasCargo =
    mission.cargo.metal > 0 || mission.cargo.crystal > 0 || mission.cargo.deuterium > 0;
  const showCargo = mission.status === 'returning' && hasCargo;
  const shipDetails = missionShipManifest(mission.ships);

  return (
    <tr
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <td>{formatMissionType(mission.type)}</td>
      <td className="number">{formatTargetLabel(mission.targetCoordinates)}</td>
      <td>
        <span className={`mission-status mission-status-${mission.status}`}>
          {statusLabel}
        </span>
      </td>
      <td className="number">{countdown || '00:00:00'}</td>
      <td>{showCargo ? formatCargo(mission.cargo) : '—'}</td>
      <td style={{ position: 'relative' }}>
        {mission.status === 'outbound' && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onRecall(mission.id)}
          >
            Recall
          </button>
        )}
        {godMode && mission.status !== 'completed' && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onResolve(mission.id)}
          >
            ⚡ Resolve
          </button>
        )}
        {showTooltip && shipDetails && (
          <div
            className="fleet-mission-tooltip"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              zIndex: 5,
              marginTop: 4,
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(10, 16, 30, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#e7f2ff',
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            {shipDetails}
          </div>
        )}
      </td>
    </tr>
  );
}

interface CombatEstimate {
  ratio: number;
  title: string;
  message: string;
  toneClass: 'combat-outmatched' | 'combat-risky' | 'combat-advantage';
}

function calculateAttackerPower(
  ships: Record<string, number>,
  weaponsTechnology: number,
): number {
  const techMultiplier = 1 + 0.1 * weaponsTechnology;
  let total = 0;

  for (const [shipId, countValue] of Object.entries(ships)) {
    const count = Math.max(0, Math.floor(countValue));
    if (count <= 0) continue;

    const ship = SHIPS[shipId as keyof typeof SHIPS];
    if (!ship) continue;
    total += ship.attack * count * techMultiplier;
  }

  return total;
}

function calculateDefenderPower(
  fleet: Record<string, number> | undefined,
  defences: Record<string, number>,
): number {
  let total = 0;

  for (const [shipId, countValue] of Object.entries(fleet ?? {})) {
    const count = Math.max(0, Math.floor(countValue));
    if (count <= 0) continue;

    const ship = SHIPS[shipId as keyof typeof SHIPS];
    if (!ship) continue;
    total += ship.hull * count;
  }

  for (const [defenceId, countValue] of Object.entries(defences)) {
    const count = Math.max(0, Math.floor(countValue));
    if (count <= 0) continue;

    const defence = DEFENCES[defenceId as keyof typeof DEFENCES];
    if (!defence) continue;
    total += defence.hull * count;
  }

  return total;
}

function buildCombatEstimate(ratio: number): CombatEstimate {
  if (ratio < 0.5) {
    return {
      ratio,
      title: 'Outmatched',
      message: 'Your fleet will likely be destroyed',
      toneClass: 'combat-outmatched',
    };
  }

  if (ratio < 1.5) {
    return {
      ratio,
      title: 'Risky odds',
      message: 'Outcome is uncertain',
      toneClass: 'combat-risky',
    };
  }

  return {
    ratio,
    title: 'Clear advantage',
    message: 'Victory is likely',
    toneClass: 'combat-advantage',
  };
}

export function FleetPanel() {
  const {
    gameState,
    espionageReports,
    fleetTarget,
    setFleetTarget,
    pendingMissionTarget,
    setPendingMissionTarget,
    dispatchFleet,
    dispatchEspionage,
    recallFleet,
    adminResolveMission,
    adminResolveAllMissions,
  } = useGame();
  const sourcePlanetIndex = gameState.activePlanetIndex;
  const sourcePlanet = gameState.planets[sourcePlanetIndex];
  const [selectedShips, setSelectedShips] = useState<Record<string, number>>({});
  const [missionType, setMissionType] = useState<MissionType>('attack');
  const [transportTargetIndex, setTransportTargetIndex] = useState<number>(-1);
  const [transportCargo, setTransportCargo] = useState({
    metal: 0,
    crystal: 0,
    deuterium: 0,
  });

  useEffect(() => {
    setSelectedShips({});
    setTransportCargo({ metal: 0, crystal: 0, deuterium: 0 });
  }, [
    sourcePlanetIndex,
    fleetTarget?.galaxy,
    fleetTarget?.system,
    fleetTarget?.slot,
  ]);

  useEffect(() => {
    if (missionType === 'espionage' && sourcePlanet.ships.espionageProbe <= 0) {
      setMissionType('attack');
      setSelectedShips({});
    }
  }, [missionType, sourcePlanet.ships.espionageProbe]);

  const transportTargets = gameState.planets
    .map((planet, index) => ({ planet, index }))
    .filter(({ index }) => index !== sourcePlanetIndex);

  useEffect(() => {
    if (!pendingMissionTarget) {
      return;
    }

    setSelectedShips({});
    setTransportCargo({ metal: 0, crystal: 0, deuterium: 0 });

    if (pendingMissionTarget.type === 'transport') {
      setMissionType('transport');
      setFleetTarget(null);
      const targetIndex = gameState.planets.findIndex(
        (planet, index) =>
          index !== sourcePlanetIndex &&
          planet.coordinates.galaxy === pendingMissionTarget.coords.galaxy &&
          planet.coordinates.system === pendingMissionTarget.coords.system &&
          planet.coordinates.slot === pendingMissionTarget.coords.slot,
      );
      if (targetIndex >= 0) {
        setTransportTargetIndex(targetIndex);
      }
    } else {
      setMissionType(pendingMissionTarget.type === 'espionage' ? 'espionage' : 'attack');
      setFleetTarget(pendingMissionTarget.coords);
    }

    setPendingMissionTarget(null);
  }, [
    gameState.planets,
    pendingMissionTarget,
    setFleetTarget,
    setPendingMissionTarget,
    sourcePlanetIndex,
  ]);

  useEffect(() => {
    if (missionType !== 'transport') {
      return;
    }

    if (transportTargets.length === 0) {
      setTransportTargetIndex(-1);
      return;
    }

    const hasSelected = transportTargets.some(({ index }) => index === transportTargetIndex);
    if (!hasSelected) {
      setTransportTargetIndex(transportTargets[0].index);
    }
  }, [missionType, sourcePlanetIndex, transportTargetIndex, transportTargets]);

  const availableShips = SHIP_ORDER.filter(
    (shipId) => shipId !== 'solarSatellite' && sourcePlanet.ships[shipId] > 0,
  );
  const maxProbePerMission = Math.min(
    sourcePlanet.ships.espionageProbe,
    gameState.settings.maxProbeCount,
  );
  const espionageAvailable = sourcePlanet.ships.espionageProbe > 0;
  const shipSelection = missionType === 'espionage'
    ? availableShips.filter((shipId) => shipId === 'espionageProbe')
    : availableShips;
  const transportTarget = transportTargets.find(
    ({ index }) => index === transportTargetIndex,
  )?.planet ?? null;
  const missionTarget =
    missionType === 'transport'
      ? transportTarget?.coordinates ?? null
      : fleetTarget;
  const cargoCapacity = calcCargoCapacity(selectedShips);
  const totalTransportCargo =
    transportCargo.metal + transportCargo.crystal + transportCargo.deuterium;

  const activeMissions = gameState.fleetMissions.filter(
    (mission) => mission.status !== 'completed',
  );
  const maxSlots = calcMaxFleetSlots(gameState.research);
  const slotsFull = activeMissions.length >= maxSlots;

  const selectedShipCount = useMemo(() => {
    if (missionType === 'espionage') {
      return Math.max(
        0,
        Math.min(maxProbePerMission, Math.floor(selectedShips.espionageProbe ?? 0)),
      );
    }

    return Object.values(selectedShips).reduce(
      (total, value) => total + Math.max(0, Math.floor(value)),
      0,
    );
  }, [maxProbePerMission, missionType, selectedShips]);

  const dispatchPreview = useMemo(() => {
    if (!missionTarget || selectedShipCount <= 0) {
      return {
        distance: 0,
        speed: 0,
        travelSeconds: 0,
        fuelCost: 0,
        arrivalTime: 0,
        returnTime: 0,
      };
    }

    const distance = calcDistance(sourcePlanet.coordinates, missionTarget);
    const speed = calcFleetSpeed(selectedShips, gameState.research);
    const baseTravelSeconds = calcTravelSeconds(
      distance,
      speed,
      gameState.settings.gameSpeed,
    );
    const travelSeconds = missionType === 'espionage'
      ? Math.min(baseTravelSeconds, ESPIONAGE_MAX_TRAVEL_SECONDS)
      : baseTravelSeconds;
    const fuelCost = missionType === 'espionage'
      ? ESPIONAGE_MIN_FUEL_COST
      : calcFuelCost(selectedShips, distance);
    const now = Date.now();

    return {
      distance,
      speed,
      travelSeconds,
      fuelCost,
      arrivalTime: now + travelSeconds * 1000,
      returnTime: now + travelSeconds * 2000,
    };
  }, [
    missionTarget,
    gameState.research,
    gameState.settings.gameSpeed,
    missionType,
    selectedShips,
    selectedShipCount,
    sourcePlanet.coordinates,
  ]);

  const latestCombatIntel = useMemo(() => {
    if (!fleetTarget || missionType !== 'attack') {
      return null;
    }

    return espionageReports
      .filter(
        (report) =>
          report.targetCoordinates.galaxy === fleetTarget.galaxy &&
          report.targetCoordinates.system === fleetTarget.system &&
          report.targetCoordinates.slot === fleetTarget.slot &&
          report.detected === false &&
          report.defences !== undefined,
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  }, [espionageReports, fleetTarget, missionType]);

  const combatEstimate = useMemo(() => {
    if (!latestCombatIntel || selectedShipCount <= 0) {
      return null;
    }

    const attackerPower = calculateAttackerPower(
      selectedShips,
      gameState.research.weaponsTechnology,
    );
    if (attackerPower <= 0) {
      return null;
    }

    const defenderPower = calculateDefenderPower(
      latestCombatIntel.fleet,
      latestCombatIntel.defences ?? {},
    );
    const ratio =
      defenderPower > 0 ? attackerPower / defenderPower : Number.POSITIVE_INFINITY;
    return buildCombatEstimate(ratio);
  }, [gameState.research.weaponsTechnology, latestCombatIntel, selectedShipCount, selectedShips]);

  const insufficientFuel = sourcePlanet.resources.deuterium < dispatchPreview.fuelCost;
  const invalidTransportCargo =
    missionType === 'transport' &&
    (totalTransportCargo <= 0 || totalTransportCargo > cargoCapacity);
  const canDispatch =
    missionTarget !== null &&
    selectedShipCount > 0 &&
    !slotsFull &&
    !insufficientFuel &&
    !invalidTransportCargo;

  return (
    <section className="panel">
      <h1 className="panel-title">Fleet Command</h1>
      <p className="panel-subtitle">Dispatch attacks against NPC colonies and track active missions.</p>

      <div className="panel-card fleet-dispatch-card">
        {missionType !== 'transport' && !missionTarget && (
          <p className="hint">Select an NPC target from the Galaxy panel to prepare an attack mission.</p>
        )}

          {missionType === 'transport' ? (
            <div className="fleet-mission-type">
              <label htmlFor="transport-target-select" className="label">Send To</label>
              <select
                id="transport-target-select"
                className="input fleet-mission-select"
                value={transportTargetIndex}
                onChange={(event) => {
                  setTransportTargetIndex(Number.parseInt(event.target.value, 10));
                }}
              >
                {transportTargets.map(({ planet, index }) => (
                  <option key={index} value={index}>
                    {planet.name} {formatTargetLabel(planet.coordinates)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            missionTarget && (
              <div className="fleet-target-row">
                <span className="label">Target</span>
                <span className="number">{formatTargetLabel(missionTarget)}</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setFleetTarget(null)}
                >
                  Clear
                </button>
              </div>
            )
          )}

          <div className="fleet-mission-type">
            <label htmlFor="fleet-mission-select" className="label">Mission Type</label>
            <select
              id="fleet-mission-select"
              className="input fleet-mission-select"
              value={missionType}
              onChange={(event) => {
                const value = event.target.value;
                const nextType =
                  value === 'espionage'
                    ? 'espionage'
                    : value === 'transport'
                      ? 'transport'
                      : 'attack';
                setMissionType(nextType);
                setSelectedShips({});
                setTransportCargo({ metal: 0, crystal: 0, deuterium: 0 });
              }}
            >
              <option value="attack">Attack</option>
              {espionageAvailable && <option value="espionage">Espionage</option>}
              {transportTargets.length > 0 && <option value="transport">Transport</option>}
            </select>
          </div>

          {shipSelection.length === 0 ? (
            <p className="hint">
              {missionType === 'espionage'
                ? 'No espionage probes available on this planet.'
                : 'No ships available on this planet.'}
            </p>
          ) : (
            <div className="fleet-ship-grid">
              {shipSelection.map((shipId) => {
                const maxCount =
                  missionType === 'espionage' && shipId === 'espionageProbe'
                    ? maxProbePerMission
                    : sourcePlanet.ships[shipId];
                const value = Math.min(maxCount, Math.max(0, selectedShips[shipId] ?? 0));

                return (
                  <div key={shipId} className="fleet-ship-row">
                    <div>
                      <strong>{SHIPS[shipId].name}</strong>
                      <p className="hint">Available: {formatNumber(maxCount)}</p>
                    </div>
                    <div className="fleet-ship-inputs">
                      <input
                        type="number"
                        min={0}
                        max={maxCount}
                        value={value}
                        className="input quantity-input"
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          const nextValue = Number.isFinite(parsed) ? parsed : 0;
                          const clamped = Math.max(0, Math.min(maxCount, nextValue));
                          setSelectedShips((current) => ({
                            ...current,
                            [shipId]: clamped,
                          }));
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          setSelectedShips((current) => ({
                            ...current,
                            [shipId]: maxCount,
                          }));
                        }}
                      >
                        Max
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {missionType === 'transport' && (
            <div className="fleet-ship-grid">
              <div className="fleet-ship-row">
                <div>
                  <strong>Cargo Manifest</strong>
                  <p className="hint">Capacity: {formatNumber(cargoCapacity)}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    let remaining = cargoCapacity;
                    const metal = Math.min(sourcePlanet.resources.metal, remaining);
                    remaining -= metal;
                    const crystal = Math.min(sourcePlanet.resources.crystal, remaining);
                    remaining -= crystal;
                    const deuterium = Math.min(sourcePlanet.resources.deuterium, remaining);
                    setTransportCargo({ metal, crystal, deuterium });
                  }}
                >
                  Max
                </button>
              </div>
              {(['metal', 'crystal', 'deuterium'] as const).map((resource) => {
                const available = sourcePlanet.resources[resource];
                const maxEach = Math.max(0, Math.floor(Math.min(available, cargoCapacity / 3)));
                return (
                  <div key={resource} className="fleet-ship-row">
                    <label className="label" htmlFor={`transport-${resource}`}>
                      {resource[0].toUpperCase()}{resource.slice(1)}
                    </label>
                    <input
                      id={`transport-${resource}`}
                      type="number"
                      min={0}
                      max={maxEach}
                      value={transportCargo[resource]}
                      className="input quantity-input"
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        const nextValue = Number.isFinite(parsed) ? parsed : 0;
                        const clamped = Math.max(0, Math.min(maxEach, nextValue));
                        setTransportCargo((current) => ({
                          ...current,
                          [resource]: clamped,
                        }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="fleet-preview-grid">
            <p className="stat-line">
              <span className="label">Fleet Speed</span>
              <span className="number">{formatNumber(Math.floor(dispatchPreview.speed))}</span>
            </p>
            <p className="stat-line">
              <span className="label">Travel Time</span>
              <span className="number">{formatDuration(dispatchPreview.travelSeconds)}</span>
            </p>
            <p className="stat-line">
              <span className="label">Arrival ETA</span>
              <span className="number">
                {dispatchPreview.arrivalTime > 0 ? formatEta(dispatchPreview.arrivalTime) : '--'}
              </span>
            </p>
            <p className="stat-line">
              <span className="label">Return ETA</span>
              <span className="number">
                {dispatchPreview.returnTime > 0 ? formatEta(dispatchPreview.returnTime) : '--'}
              </span>
            </p>
            <p className="stat-line">
              <span className="label">Distance</span>
              <span className="number">{formatNumber(dispatchPreview.distance)}</span>
            </p>
            <p className="stat-line">
              <span className="label">Fuel Cost (Deuterium)</span>
              <span className="number">{formatNumber(dispatchPreview.fuelCost)}</span>
            </p>
          </div>

          {combatEstimate && missionType === 'attack' && (
            <div className={`fleet-combat-estimate ${combatEstimate.toneClass}`}>
              <div className="fleet-combat-header">
                <strong>Combat estimate</strong>
                <span className="number">x{combatEstimate.ratio.toFixed(2)}</span>
              </div>
              <p className="fleet-combat-title">{combatEstimate.title}</p>
              <p className="hint">{combatEstimate.message}</p>
              <p className="hint">Approximate only, based on latest espionage report.</p>
            </div>
          )}

          {insufficientFuel && (
            <p className="hint danger">
              Not enough deuterium on this planet for the required fuel.
            </p>
          )}

          <div className="fleet-dispatch-footer">
            <span className="label">
              Missions: {activeMissions.length} / {maxSlots}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canDispatch}
              onClick={() => {
                if (!missionTarget) return;

                const mission =
                  missionType === 'espionage'
                    ? dispatchEspionage(
                        sourcePlanetIndex,
                        missionTarget,
                        Math.min(maxProbePerMission, selectedShips.espionageProbe ?? 0),
                      )
                    : dispatchFleet(
                        sourcePlanetIndex,
                        missionTarget,
                        selectedShips,
                        missionType,
                        missionType === 'transport' ? transportCargo : undefined,
                      );
                if (mission) {
                  setSelectedShips({});
                  setTransportCargo({ metal: 0, crystal: 0, deuterium: 0 });
                }
              }}
            >
              {missionType === 'espionage'
                ? 'Dispatch Espionage'
                : missionType === 'transport'
                  ? 'Dispatch Transport'
                  : 'Dispatch Attack'}
            </button>
          </div>
      </div>

      <div className="panel-card">
        <div className="fleet-active-header">
          <h2 className="section-title">Active Missions</h2>
          <div className="admin-inline-row">
            <span className="label">
              Missions: {activeMissions.length} / {maxSlots}
            </span>
            {gameState.settings.godMode && activeMissions.length > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => adminResolveAllMissions()}
              >
                ⚡ Resolve All
              </button>
            )}
          </div>
        </div>

        {activeMissions.length === 0 ? (
          <p className="hint">No active missions</p>
        ) : (
          <div className="table-wrap">
            <table className="fleet-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Next Transition</th>
                  <th>Cargo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeMissions.map((mission) => (
                  <MissionRow
                    key={mission.id}
                    mission={mission}
                    onRecall={recallFleet}
                    onResolve={adminResolveMission}
                    godMode={gameState.settings.godMode}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
