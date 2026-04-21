import { useEffect, useMemo, useState } from 'react';
import type { FleetMission, MissionType } from '../models/Fleet.ts';
import { SHIP_ORDER, SHIPS } from '../data/ships.ts';
import { useGame } from '../context/GameContext';
import { PanelBanner } from '../components/PanelBanner';
import {
  calcCargoCapacity,
  calcDistance,
  calcFleetSpeed,
  calcFuelCost,
  calcMaxFleetSlots,
  calcTravelSeconds,
} from '../engine/FleetEngine.ts';
import { simulatePreview } from '../engine/CombatEngine.ts';
import { useCountdown } from '../hooks/useCountdown.ts';
import { formatNumber } from '../utils/format.ts';
import { formatDuration } from '../utils/time.ts';
import { missionShipManifest } from '../utils/fleet.ts';

const ESPIONAGE_MAX_TRAVEL_SECONDS = 10;
const ESPIONAGE_MIN_FUEL_COST = 1;

// ── Mission config ─────────────────────────────────────────────────────────────

const MISSION_CONFIG: Record<MissionType, { color: string; label: string; bg: string; border: string }> = {
  attack:    { color: '#f87171', label: 'Attack',    bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  harvest:   { color: '#30d5c8', label: 'Harvest',   bg: 'rgba(48,213,200,0.1)',   border: 'rgba(48,213,200,0.3)' },
  espionage: { color: '#818cf8', label: 'Espionage', bg: 'rgba(129,140,248,0.1)',  border: 'rgba(129,140,248,0.3)' },
  transport: { color: '#34d399', label: 'Transport', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)' },
  colonise:  { color: '#a78bfa', label: 'Colonise',  bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.3)' },
  deploy:    { color: '#34d399', label: 'Deploy',    bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.25)' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  outbound:  { color: '#4d8fff', label: 'Outbound' },
  returning: { color: '#34d399', label: 'Returning' },
  at_target: { color: '#f0a832', label: 'At Target' },
  completed: { color: '#6b7280', label: 'Completed' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function usesPlayerPlanetTarget(type: MissionType): boolean {
  return type === 'transport' || type === 'deploy';
}

function usesManualCargo(type: MissionType): boolean {
  return type === 'transport' || type === 'deploy';
}

function missionTargetHint(type: MissionType): string {
  if (type === 'transport') return 'Select one of your colonies as the transport target.';
  if (type === 'deploy') return 'Select one of your planets to station the fleet there.';
  if (type === 'colonise') return 'Select an empty slot from the Galaxy panel to prepare a colonisation mission.';
  return 'Select an NPC target from the Galaxy panel to prepare a fleet mission.';
}

function dispatchLabel(type: MissionType): string {
  if (type === 'espionage') return 'Dispatch Espionage';
  if (type === 'transport') return 'Dispatch Transport';
  if (type === 'colonise') return 'Dispatch Colonise';
  if (type === 'deploy') return 'Deploy Fleet';
  if (type === 'harvest') return 'Dispatch Harvest';
  return 'Dispatch Attack';
}

// ── Combat preview logic ───────────────────────────────────────────────────────

interface FleetCombatPreview {
  title: string;
  toneClass: 'combat-outmatched' | 'combat-risky' | 'combat-advantage';
  winProbability: number;
  drawProbability: number;
  topAttackerLosses: string[];
}

function buildCombatPreviewTitle(
  winProbability: number,
): Pick<FleetCombatPreview, 'title' | 'toneClass'> {
  if (winProbability > 0.75) {
    return { title: 'Clear advantage', toneClass: 'combat-advantage' };
  }
  if (winProbability >= 0.25) {
    return { title: 'Risky odds', toneClass: 'combat-risky' };
  }
  return { title: 'Outmatched', toneClass: 'combat-outmatched' };
}

// ── MissionCard ────────────────────────────────────────────────────────────────

interface MissionCardProps {
  mission: FleetMission;
  onRecall: (missionId: string) => void;
  onResolve: (missionId: string) => void;
  godMode: boolean;
  departureTime: number;
  now: number;
}

function MissionCard({ mission, onRecall, onResolve, godMode, departureTime, now }: MissionCardProps) {
  const mc = MISSION_CONFIG[mission.type] ?? MISSION_CONFIG.attack;
  const sc = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.outbound;

  const nextTransition =
    mission.status === 'outbound'
      ? mission.arrivalTime
      : mission.status === 'returning'
        ? mission.returnTime
        : null;

  const countdown = useCountdown(nextTransition && nextTransition > 0 ? nextTransition : null);

  const hasCargo = mission.cargo.metal > 0 || mission.cargo.crystal > 0 || mission.cargo.deuterium > 0;
  const showCargo = mission.status === 'returning' && hasCargo;

  // Progress calculation
  let progress = 0;
  if (mission.status === 'outbound') {
    const total = mission.arrivalTime - departureTime;
    const elapsed = now - departureTime;
    progress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
  } else if (mission.status === 'returning') {
    const total = mission.returnTime - mission.arrivalTime;
    const elapsed = now - mission.arrivalTime;
    progress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
  } else if (mission.status === 'at_target' || mission.status === 'completed') {
    progress = 1;
  }

  // Ship manifest as inline chips (uses missionShipManifest, parses the string)
  const shipManifestStr = missionShipManifest(mission.ships);
  const shipChips = shipManifestStr
    ? shipManifestStr.split(', ').map((entry) => entry.trim()).filter(Boolean)
    : [];

  return (
    <div className="fleet-mission-card" style={{ borderColor: mc.border, background: mc.bg }}>
      {/* Row 1: type pill + coords + status + ETA */}
      <div className="fleet-mission-header">
        <div className="fleet-mission-header__left">
          <span className="fleet-mission-pill" style={{ color: mc.color, borderColor: mc.border }}>
            {mc.label}
          </span>
          <span className="fleet-mission-coords">{formatTargetLabel(mission.targetCoordinates)}</span>
        </div>
        <div className="fleet-mission-header__right">
          <span className="fleet-mission-status" style={{ color: sc.color, borderColor: `${sc.color}40`, background: `${sc.color}15` }}>
            {sc.label}
          </span>
          <span className="fleet-mission-eta" style={{ color: sc.color }}>
            ETA {countdown || '00:00:00'}
          </span>
        </div>
      </div>

      {/* Row 2: progress bar */}
      <div className="fleet-mission-progress">
        <div
          className="fleet-mission-progress-fill"
          style={{
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg,${mc.color}80,${mc.color})`,
            boxShadow: `0 0 8px ${mc.color}60`,
          }}
        />
      </div>

      {/* Row 3: ship chips */}
      {shipChips.length > 0 && (
        <div className="fleet-ship-chips">
          {shipChips.map((chip) => (
            <span key={chip} className="fleet-ship-chip">{chip}</span>
          ))}
        </div>
      )}

      {/* Cargo summary when returning with loot */}
      {showCargo && (
        <div className="fleet-mission-cargo">
          {'↩ M'} {formatNumber(mission.cargo.metal)}{'  C'} {formatNumber(mission.cargo.crystal)}{'  D'} {formatNumber(mission.cargo.deuterium)}
        </div>
      )}

      {/* Footer: actions */}
      <div className="fleet-mission-actions">
        {mission.status === 'outbound' && (
          <button type="button" className="fleet-recall-btn" onClick={() => onRecall(mission.id)}>
            Recall
          </button>
        )}
        {godMode && mission.status !== 'completed' && (
          <button type="button" className="fleet-recall-btn" onClick={() => onResolve(mission.id)}>
            ⚡ Resolve
          </button>
        )}
      </div>
    </div>
  );
}

// ── FleetPanel ─────────────────────────────────────────────────────────────────

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
  const [transportCargo, setTransportCargo] = useState({ metal: 0, crystal: 0, deuterium: 0 });
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Tick clock for dispatchPreview
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => { window.clearInterval(intervalId); };
  }, []);

  // Reset ships + cargo when target changes
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSelectedShips({});
      setTransportCargo({ metal: 0, crystal: 0, deuterium: 0 });
    }, 0);
    return () => { window.clearTimeout(timeoutId); };
  }, [sourcePlanetIndex, fleetTarget?.galaxy, fleetTarget?.system, fleetTarget?.slot]);

  // Auto-reset to attack if espionage probe is gone
  useEffect(() => {
    if (missionType !== 'espionage' || sourcePlanet.ships.espionageProbe > 0) return;
    const timeoutId = window.setTimeout(() => {
      setMissionType('attack');
      setSelectedShips({});
    }, 0);
    return () => { window.clearTimeout(timeoutId); };
  }, [missionType, sourcePlanet.ships.espionageProbe]);

  const transportTargets = gameState.planets
    .map((planet, index) => ({ planet, index }))
    .filter(({ index }) => index !== sourcePlanetIndex);

  // Pending mission target state machine
  useEffect(() => {
    if (!pendingMissionTarget) return;
    const timeoutId = window.setTimeout(() => {
      setSelectedShips({});
      setTransportCargo({ metal: 0, crystal: 0, deuterium: 0 });
      if (usesPlayerPlanetTarget(pendingMissionTarget.type)) {
        setMissionType(pendingMissionTarget.type);
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
        setMissionType(pendingMissionTarget.type);
        setFleetTarget(pendingMissionTarget.coords);
      }
      setPendingMissionTarget(null);
    }, 0);
    return () => { window.clearTimeout(timeoutId); };
  }, [gameState.planets, pendingMissionTarget, setFleetTarget, setPendingMissionTarget, sourcePlanetIndex]);

  // Transport-target auto-select
  useEffect(() => {
    if (!usesPlayerPlanetTarget(missionType)) return;
    if (transportTargets.length === 0) {
      const timeoutId = window.setTimeout(() => { setTransportTargetIndex(-1); }, 0);
      return () => { window.clearTimeout(timeoutId); };
    }
    const hasSelected = transportTargets.some(({ index }) => index === transportTargetIndex);
    if (!hasSelected) {
      const timeoutId = window.setTimeout(() => { setTransportTargetIndex(transportTargets[0].index); }, 0);
      return () => { window.clearTimeout(timeoutId); };
    }
  }, [missionType, sourcePlanetIndex, transportTargetIndex, transportTargets]);

  const availableShips = SHIP_ORDER.filter(
    (shipId) => shipId !== 'solarSatellite' && sourcePlanet.ships[shipId] > 0,
  );
  const maxProbePerMission = Math.min(sourcePlanet.ships.espionageProbe, gameState.settings.maxProbeCount);
  const espionageAvailable = sourcePlanet.ships.espionageProbe > 0;
  const shipSelection =
    missionType === 'espionage'
      ? availableShips.filter((shipId) => shipId === 'espionageProbe')
      : availableShips;

  const transportTarget = transportTargets.find(({ index }) => index === transportTargetIndex)?.planet ?? null;
  const missionTarget =
    usesPlayerPlanetTarget(missionType)
      ? transportTarget?.coordinates ?? null
      : fleetTarget;

  const cargoCapacity = calcCargoCapacity(selectedShips);
  const totalTransportCargo = transportCargo.metal + transportCargo.crystal + transportCargo.deuterium;

  const activeMissions = gameState.fleetMissions.filter((m) => m.status !== 'completed');
  const maxSlots = calcMaxFleetSlots(gameState.research);
  const slotsFull = activeMissions.length >= maxSlots;

  const selectedShipCount = useMemo(() => {
    if (missionType === 'espionage') {
      return Math.max(0, Math.min(maxProbePerMission, Math.floor(selectedShips.espionageProbe ?? 0)));
    }
    return Object.values(selectedShips).reduce((total, value) => total + Math.max(0, Math.floor(value)), 0);
  }, [maxProbePerMission, missionType, selectedShips]);

  const previewShips = useMemo(() => {
    if (selectedShipCount > 0) {
      return selectedShips;
    }

    const fallbackShips: Record<string, number> = {};
    for (const shipId of availableShips) {
      fallbackShips[shipId] = sourcePlanet.ships[shipId];
    }
    return fallbackShips;
  }, [availableShips, selectedShipCount, selectedShips, sourcePlanet.ships]);

  const previewShipCount = useMemo(
    () => Object.values(previewShips).reduce((total, value) => total + Math.max(0, Math.floor(value)), 0),
    [previewShips],
  );

  const dispatchPreview = useMemo(() => {
    if (!missionTarget || selectedShipCount <= 0) {
      return { distance: 0, speed: 0, travelSeconds: 0, fuelCost: 0, arrivalTime: 0, returnTime: 0 };
    }
    const distance = calcDistance(sourcePlanet.coordinates, missionTarget);
    const speed = calcFleetSpeed(selectedShips, gameState.research);
    const baseTravelSeconds = calcTravelSeconds(distance, speed, gameState.settings.gameSpeed);
    const travelSeconds = missionType === 'espionage'
      ? Math.min(baseTravelSeconds, ESPIONAGE_MAX_TRAVEL_SECONDS)
      : baseTravelSeconds;
    const fuelCost = missionType === 'espionage'
      ? ESPIONAGE_MIN_FUEL_COST
      : calcFuelCost(selectedShips, distance);
    return {
      distance,
      speed,
      travelSeconds,
      fuelCost,
      arrivalTime: currentTime + travelSeconds * 1000,
      returnTime: currentTime + travelSeconds * 2000,
    };
  }, [
    currentTime,
    missionTarget,
    gameState.research,
    gameState.settings.gameSpeed,
    missionType,
    selectedShips,
    selectedShipCount,
    sourcePlanet.coordinates,
  ]);

  const latestCombatIntel = useMemo(() => {
    if (!fleetTarget || missionType !== 'attack') return null;
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

  const combatPreview = useMemo(() => {
    if (!latestCombatIntel || !fleetTarget || previewShipCount <= 0) return null;
    const preview = simulatePreview(
      {
        ships: previewShips,
        techs: {
          weaponsTechnology: gameState.research.weaponsTechnology,
          shieldingTechnology: gameState.research.shieldingTechnology,
          armourTechnology: gameState.research.armourTechnology,
        },
      },
      {
        ships: latestCombatIntel.fleet ?? {},
        defences: latestCombatIntel.defences ?? {},
        techs: {
          weaponsTechnology: 0,
          shieldingTechnology: 0,
          armourTechnology: 0,
        },
      },
      fleetTarget.galaxy * 1000000 + fleetTarget.system * 1000 + fleetTarget.slot,
      10,
    );

    const topAttackerLosses = Object.entries(preview.averageAttackerLosses)
      .map(([shipId, averageLosses]) => ({
        shipId,
        averageLosses: averageLosses ?? 0,
        roundedLosses: Math.round(averageLosses ?? 0),
      }))
      .filter(({ roundedLosses }) => roundedLosses > 0)
      .sort((left, right) => right.averageLosses - left.averageLosses)
      .slice(0, 3)
      .map(({ shipId, roundedLosses }) => {
        const ship = SHIPS[shipId as keyof typeof SHIPS];
        return `${roundedLosses} ${ship?.name ?? shipId}`;
      });

    return {
      ...buildCombatPreviewTitle(preview.winProbability),
      winProbability: preview.winProbability,
      drawProbability: preview.drawProbability,
      topAttackerLosses,
    };
  }, [
    fleetTarget,
    gameState.research.armourTechnology,
    gameState.research.shieldingTechnology,
    gameState.research.weaponsTechnology,
    latestCombatIntel,
    previewShipCount,
    previewShips,
  ]);

  const cargoInfo = useMemo(() => {
    if (missionType !== 'attack' || !fleetTarget) return null;
    const colony = gameState.galaxy.npcColonies.find(
      (c) =>
        c.coordinates.galaxy === fleetTarget.galaxy &&
        c.coordinates.system === fleetTarget.system &&
        c.coordinates.slot === fleetTarget.slot,
    );
    if (!colony) return null;
    const reportWithResources = espionageReports
      .filter(
        (report) =>
          report.targetCoordinates.galaxy === fleetTarget.galaxy &&
          report.targetCoordinates.system === fleetTarget.system &&
          report.targetCoordinates.slot === fleetTarget.slot &&
          report.detected === false &&
          report.resources !== undefined,
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!reportWithResources?.resources) return null;
    const resources = reportWithResources.resources;
    const lootable = Math.floor((resources.metal + resources.crystal + resources.deuterium) * 0.5);
    const largeCargoCap = SHIPS.largeCargo.cargoCapacity;
    const smallCargoCap = SHIPS.smallCargo.cargoCapacity;
    const availableLarge = sourcePlanet.ships.largeCargo ?? 0;
    const availableSmall = sourcePlanet.ships.smallCargo ?? 0;
    const deficit = Math.max(0, lootable - cargoCapacity);
    const additionalLarge = Math.ceil(deficit / largeCargoCap);
    const additionalSmall = Math.ceil(deficit / smallCargoCap);
    return { lootable, additionalLarge, additionalSmall, availableLarge, availableSmall };
  }, [cargoCapacity, espionageReports, fleetTarget, gameState.galaxy.npcColonies, missionType, sourcePlanet.ships]);

  const insufficientFuel = sourcePlanet.resources.deuterium < dispatchPreview.fuelCost;
  const invalidTransportCargo =
    (missionType === 'transport' && (totalTransportCargo <= 0 || totalTransportCargo > cargoCapacity)) ||
    (missionType === 'deploy' && totalTransportCargo > cargoCapacity);
  const invalidColoniseFleet = missionType === 'colonise' && (selectedShips.colonyShip ?? 0) !== 1;
  const canDispatch =
    missionTarget !== null &&
    selectedShipCount > 0 &&
    !slotsFull &&
    !insufficientFuel &&
    !invalidTransportCargo &&
    !invalidColoniseFleet;

  const remainingLarge = cargoInfo ? Math.max(0, cargoInfo.availableLarge - (selectedShips.largeCargo ?? 0)) : 0;
  const remainingSmall = cargoInfo ? Math.max(0, cargoInfo.availableSmall - (selectedShips.smallCargo ?? 0)) : 0;
  const cargoAddableLarge = cargoInfo ? Math.min(cargoInfo.additionalLarge, remainingLarge) : 0;
  const cargoAddableSmall = cargoInfo ? Math.min(cargoInfo.additionalSmall, remainingSmall) : 0;

  const mc = MISSION_CONFIG[missionType];

  function handleMissionTypeChange(type: MissionType) {
    setMissionType(type);
    setSelectedShips({});
    setTransportCargo({ metal: 0, crystal: 0, deuterium: 0 });
  }

  return (
    <section className="panel">
      <PanelBanner panel="fleet" title="Fleet" subtitle="Dispatch missions, track movements, manage your war fleet." />

      {/* ── Active Missions ─────────────────────────────────────────────── */}
      <section className="fleet-section">
        <div className="fleet-section-header">
          <h2 className="fleet-section-title">Active Missions</h2>
          <div className="fleet-section-divider" />
          <span className={`fleet-section-slots${slotsFull ? ' fleet-slots-counter--full' : ''}`}>
            {activeMissions.length} / {maxSlots} slots
          </span>
          {gameState.settings.godMode && activeMissions.length > 0 && (
            <button type="button" className="fleet-recall-btn" onClick={() => adminResolveAllMissions()}>
              ⚡ Resolve All
            </button>
          )}
        </div>

        {activeMissions.length === 0 ? (
          <p className="fleet-empty-hint">No active missions.</p>
        ) : (
          <div className="fleet-mission-list">
            {activeMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onRecall={recallFleet}
                onResolve={adminResolveMission}
                godMode={gameState.settings.godMode}
                departureTime={mission.departureTime}
                now={currentTime}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Dispatch Mission ────────────────────────────────────────────── */}
      <section className="fleet-section">
        <div className="fleet-section-header">
          <h2 className="fleet-section-title">Dispatch Mission</h2>
          <div className="fleet-section-divider" />
        </div>

        <div className="fleet-dispatch-card">
          {/* Mission type — accessible labeled select (screen-reader / test compatible)
              plus visual toggle buttons that set the same state */}
          <div className="fleet-dispatch-field">
            <label htmlFor="fleet-mission-select" className="fleet-dispatch-label">Mission Type</label>
            {/* Visually hidden accessible select — drives mission type state */}
            <select
              id="fleet-mission-select"
              className="sr-only"
              value={missionType}
              onChange={(event) => {
                const value = event.target.value as MissionType;
                handleMissionTypeChange(value);
              }}
            >
              <option value="attack">Attack</option>
              {espionageAvailable && <option value="espionage">Espionage</option>}
              <option value="colonise">Colonise</option>
              <option value="harvest">Harvest</option>
              {transportTargets.length > 0 && <option value="transport">Transport</option>}
              {transportTargets.length > 0 && <option value="deploy">Deploy</option>}
            </select>
            {/* Visual toggle buttons */}
            <div className="fleet-type-row">
              {(Object.entries(MISSION_CONFIG) as Array<[MissionType, typeof MISSION_CONFIG[MissionType]]>).map(([type, cfg]) => {
                if (type === 'deploy' && transportTargets.length === 0) return null;
                if (type === 'transport' && transportTargets.length === 0) return null;
                if (type === 'espionage' && !espionageAvailable) return null;
                const active = missionType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`fleet-type-toggle${active ? ' fleet-type-toggle--active' : ''}`}
                    style={active ? {
                      background: cfg.bg,
                      borderColor: cfg.border,
                      color: cfg.color,
                    } : undefined}
                    onClick={() => handleMissionTypeChange(type)}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target row */}
          {usesPlayerPlanetTarget(missionType) ? (
            <div className="fleet-dispatch-field">
              <label htmlFor="transport-target-select" className="fleet-dispatch-label">Send To</label>
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
          ) : missionTarget ? (
            <div className="fleet-target-row">
              <span className="fleet-dispatch-label">Target</span>
              <span className="fleet-target-coords">{formatTargetLabel(missionTarget)}</span>
              <button type="button" className="fleet-recall-btn" onClick={() => setFleetTarget(null)}>
                Clear
              </button>
            </div>
          ) : (
            <p className="fleet-empty-hint">{missionTargetHint(missionType)}</p>
          )}

          {/* Ship selection grid */}
          <div>
            <div className="fleet-dispatch-label">Ships</div>
            {shipSelection.length === 0 ? (
              <p className="fleet-empty-hint">
                {missionType === 'espionage'
                  ? 'No espionage probes available on this planet.'
                  : missionType === 'colonise'
                    ? 'No ships available. Colony Ship required (exactly 1).'
                    : 'No ships available on this planet.'}
              </p>
            ) : (
              <div className="fleet-ship-grid-new">
                {shipSelection.map((shipId) => {
                  const maxCount =
                    missionType === 'espionage' && shipId === 'espionageProbe'
                      ? maxProbePerMission
                      : sourcePlanet.ships[shipId];
                  const value = Math.min(maxCount, Math.max(0, selectedShips[shipId] ?? 0));
                  return (
                    <div key={shipId} className="fleet-ship-row-new">
                      <span className="fleet-ship-name">{SHIPS[shipId].name}</span>
                      <span className="fleet-ship-avail">/{formatNumber(maxCount)}</span>
                      <input
                        type="number"
                        min={0}
                        max={maxCount}
                        value={value}
                        className="fleet-ship-qty"
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          const nextValue = Number.isFinite(parsed) ? parsed : 0;
                          const clamped = Math.max(0, Math.min(maxCount, nextValue));
                          setSelectedShips((current) => ({ ...current, [shipId]: clamped }));
                        }}
                      />
                      <button
                        type="button"
                        className="fleet-ship-max-btn"
                        onClick={() => setSelectedShips((current) => ({ ...current, [shipId]: maxCount }))}
                      >
                        Max
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {missionType === 'colonise' && (
            <p className="fleet-empty-hint">Colonise missions require exactly 1 Colony Ship. Escort ships may return after settlement.</p>
          )}

          {/* Transport / Deploy cargo inputs */}
          {usesManualCargo(missionType) && (
            <div>
              <div className="fleet-dispatch-label" style={{ marginBottom: '0.4rem' }}>
                Cargo Manifest
                <span className="fleet-cargo-cap-note">capacity {formatNumber(cargoCapacity)}</span>
                <button
                  type="button"
                  className="fleet-recall-btn fleet-cargo-max-btn"
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
              <div className="fleet-ship-grid-new">
                {(['metal', 'crystal', 'deuterium'] as const).map((resource) => {
                  const available = sourcePlanet.resources[resource];
                  const maxEach = Math.max(0, Math.floor(Math.min(available, cargoCapacity / 3)));
                  return (
                    <div key={resource} className="fleet-ship-row-new">
                      <label className="fleet-ship-name" htmlFor={`transport-${resource}`}>
                        {resource[0].toUpperCase()}{resource.slice(1)}
                      </label>
                      <span className="fleet-ship-avail">/{formatNumber(available)}</span>
                      <input
                        id={`transport-${resource}`}
                        type="number"
                        min={0}
                        max={maxEach}
                        value={transportCargo[resource]}
                        className="fleet-ship-qty"
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          const nextValue = Number.isFinite(parsed) ? parsed : 0;
                          const clamped = Math.max(0, Math.min(maxEach, nextValue));
                          setTransportCargo((current) => ({ ...current, [resource]: clamped }));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Combat estimate */}
          {combatPreview && missionType === 'attack' && (
            <div className={`fleet-combat-estimate ${combatPreview.toneClass}`}>
              <div className="fleet-combat-header">
                <strong>Combat estimate</strong>
                <span className="number">{Math.round(combatPreview.winProbability * 100)}% win probability</span>
              </div>
              <p className="fleet-combat-title">{combatPreview.title}</p>
              <p className="hint">
                Expected losses:{' '}
                {combatPreview.topAttackerLosses.length > 0 ? combatPreview.topAttackerLosses.join(', ') : 'Minimal'}
              </p>
              <p className="hint">Approximate only, based on latest espionage report.</p>
            </div>
          )}

          {/* Cargo recommendation */}
          {cargoInfo && missionType === 'attack' && (
            <div className="fleet-cargo-helper">
              <div className="fleet-cargo-header">
                <strong>Cargo needed</strong>
                <span className="hint">from spy report</span>
              </div>
              <p className="stat-line">
                <span className="label">Lootable</span>
                <span className="number">~{formatNumber(cargoInfo.lootable)}</span>
              </p>
              <p className="stat-line">
                <span className="label">Fleet cargo capacity</span>
                <span className="number">{formatNumber(cargoCapacity)}</span>
              </p>
              <div className="fleet-cargo-buttons">
                {cargoAddableLarge > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setSelectedShips((current) => ({
                        ...current,
                        largeCargo: Math.min(cargoInfo.availableLarge, (current.largeCargo ?? 0) + cargoAddableLarge),
                      }));
                    }}
                  >
                    + {cargoAddableLarge} Large Cargo
                  </button>
                )}
                {cargoAddableSmall > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setSelectedShips((current) => ({
                        ...current,
                        smallCargo: Math.min(cargoInfo.availableSmall, (current.smallCargo ?? 0) + cargoAddableSmall),
                      }));
                    }}
                  >
                    + {cargoAddableSmall} Small Cargo
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Validation warnings */}
          {insufficientFuel && (
            <p className="hint danger">Not enough deuterium on this planet for the required fuel.</p>
          )}
          {invalidColoniseFleet && (
            <p className="hint danger">Colonise missions require exactly 1 Colony Ship.</p>
          )}

          {/* Footer: stats + dispatch */}
          <div className="fleet-dispatch-footer-new">
            <div className="fleet-stat-cols">
              <div className="fleet-stat-col">
                <span className="fleet-stat-value">{formatNumber(Math.floor(dispatchPreview.speed))}</span>
                <span className="fleet-stat-label">Speed</span>
              </div>
              <div className="fleet-stat-col">
                <span className="fleet-stat-value">{formatDuration(dispatchPreview.travelSeconds)}</span>
                <span className="fleet-stat-label">Travel</span>
              </div>
              <div className="fleet-stat-col">
                <span className="fleet-stat-value" style={{ color: '#34d399' }}>
                  {dispatchPreview.fuelCost > 0 ? formatNumber(dispatchPreview.fuelCost) : '—'}
                </span>
                <span className="fleet-stat-label">Fuel</span>
              </div>
              {dispatchPreview.arrivalTime > 0 && (
                <div className="fleet-stat-col">
                  <span className="fleet-stat-value">{formatEta(dispatchPreview.arrivalTime)}</span>
                  <span className="fleet-stat-label">Arrives</span>
                </div>
              )}
            </div>
            <div className="fleet-dispatch-footer-right">
              <span className={`fleet-missions-label${slotsFull ? ' danger' : ''}`}>
                Missions: {activeMissions.length} / {maxSlots}
              </span>
              <button
                type="button"
                className="fleet-dispatch-btn"
                disabled={!canDispatch}
                style={{
                  background: canDispatch ? `linear-gradient(135deg,${mc.color}35,${mc.color}18)` : undefined,
                  borderColor: canDispatch ? mc.border : undefined,
                  color: canDispatch ? mc.color : undefined,
                }}
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
                          usesManualCargo(missionType) ? transportCargo : undefined,
                        );
                  if (mission) {
                    setSelectedShips({});
                    setTransportCargo({ metal: 0, crystal: 0, deuterium: 0 });
                  }
                }}
              >
                {dispatchLabel(missionType)}
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
