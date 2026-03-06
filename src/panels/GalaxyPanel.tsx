import { useEffect, useMemo, useRef, useState } from 'react';
import { HoverPortal } from '../components/HoverPortal';
import type { EspionageReport } from '../models/Fleet.ts';
import { useGame } from '../context/GameContext';
import { GALAXY_CONSTANTS } from '../data/galaxy.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { SHIPS } from '../data/ships.ts';
import { calcDistance, calcFuelCost, calcMaxFleetSlots } from '../engine/FleetEngine.ts';
import {
  canColonize,
  getNPCCurrentForce,
  getSystemSlots,
  type SystemSlot,
} from '../engine/GalaxyEngine.ts';
import type { Coordinates, DebrisField, NPCColony } from '../models/Galaxy.ts';
import type { ActivePanel } from '../models/types.ts';
import { formatNumber } from '../utils/format.ts';

const HOVER_CLOSE_DELAY_MS = 120;

export function npcRelativeStrengthLabel(npcPower: number, playerMilitary: number): string {
  if (playerMilitary <= 0) return 'Easy';
  const ratio = npcPower / playerMilitary;
  if (ratio < 0.3) return 'Easy';
  if (ratio < 0.7) return 'Fair';
  if (ratio < 1.3) return 'Even';
  if (ratio < 2.5) return 'Hard';
  return 'Dangerous';
}

function calcNPCPower(colony: NPCColony, now: number): number {
  const force = getNPCCurrentForce(colony, now);
  let power = 0;

  for (const [id, count] of Object.entries(force.ships)) {
    if (count > 0) {
      power += (SHIPS[id as keyof typeof SHIPS]?.weaponPower ?? 0) * count;
    }
  }

  for (const [id, count] of Object.entries(force.defences)) {
    if (count > 0) {
      power += (DEFENCES[id as keyof typeof DEFENCES]?.weaponPower ?? 0) * count;
    }
  }

  return power;
}

function formatSpecialtyLabel(specialty: string): string {
  if (!specialty) return '';
  return specialty.charAt(0).toUpperCase() + specialty.slice(1);
}

function coordsKey(coords: Coordinates): string {
  return `${coords.galaxy}:${coords.system}:${coords.slot}`;
}

function formatScannedAgo(timestamp: number, now: number): string {
  const elapsedMs = Math.max(0, now - timestamp);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  if (elapsedMinutes < 1) {
    return 'Scanned just now';
  }
  if (elapsedMinutes < 60) {
    return `Scanned ${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Scanned ${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Scanned ${elapsedDays}d ago`;
}

function formatGameHours(hours: number): string {
  const clamped = Math.max(0, hours);
  const digits = clamped >= 10 ? 0 : 1;
  return `${clamped.toFixed(digits)}h`;
}

function abandonmentStatusLabel(
  abandonment: NonNullable<EspionageReport['abandonmentProximity']>,
): string {
  if (abandonment.status === 'imminent') return 'Imminent';
  if (abandonment.status === 'atRisk') return 'At Risk';
  return 'Stable';
}

function unitName(unitId: string): string {
  return SHIPS[unitId as keyof typeof SHIPS]?.name ?? unitId;
}

function defenceName(defenceId: string): string {
  return DEFENCES[defenceId as keyof typeof DEFENCES]?.name ?? defenceId;
}

function buildingName(buildingId: string): string {
  return BUILDINGS[buildingId as keyof typeof BUILDINGS]?.name ?? buildingId;
}

function listEntries(
  values: Record<string, number> | undefined,
  nameResolver: (id: string) => string,
): Array<{ id: string; name: string; count: number }> {
  return Object.entries(values ?? {})
    .map(([id, countValue]) => ({
      id,
      name: nameResolver(id),
      count: Math.max(0, Math.floor(countValue)),
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

interface EspionageHoverPanelProps {
  report: EspionageReport | null;
  now: number;
}

function EspionageHoverPanel({ report, now }: EspionageHoverPanelProps) {
  if (!report) {
    return (
      <p className="galaxy-intel-empty">No intelligence — send probes to gather data</p>
    );
  }

  if (report.detected) {
    return (
      <>
        <p className="galaxy-intel-title">Probes detected — last spy attempt failed</p>
        <p className="galaxy-intel-meta">{formatScannedAgo(report.timestamp, now)}</p>
      </>
    );
  }

  const fleetEntries = listEntries(report.fleet, unitName);
  const defenceEntries = listEntries(report.defences, defenceName);
  const buildingEntries = listEntries(report.buildings, buildingName);
  const abandonment = report.abandonmentProximity;

  return (
    <>
      <div className="galaxy-intel-header">
        <strong>{report.targetName}</strong>
        {report.tier !== undefined && (
          <span className="galaxy-intel-tier number">Tier {report.tier}</span>
        )}
      </div>

      <p className="galaxy-intel-meta">{formatScannedAgo(report.timestamp, now)}</p>

      {report.specialty && (
        <div className="galaxy-intel-block">
          <p className="galaxy-intel-line">
            Specialty: <span className="number">{formatSpecialtyLabel(report.specialty)}</span>
          </p>
        </div>
      )}

      {abandonment && (
        <div className="galaxy-intel-block">
          <p className="galaxy-intel-label">Abandonment</p>
          <p className={`galaxy-intel-line galaxy-intel-abandonment galaxy-intel-abandonment-${abandonment.status}`}>
            {abandonmentStatusLabel(abandonment)}{' '}
            <span className="number">
              ({abandonment.recentRaidCount}/{abandonment.raidThreshold} raids)
            </span>
          </p>
          <div className="galaxy-intel-progress" role="presentation" aria-hidden="true">
            <span
              className={`galaxy-intel-progress-fill galaxy-intel-progress-fill-${abandonment.status}`}
              style={{ width: `${abandonment.progressPct}%` }}
            />
          </div>
          {abandonment.lastRaidGameHoursAgo !== undefined && (
            <p className="galaxy-intel-line">
              Last raid: <span className="number">{formatGameHours(abandonment.lastRaidGameHoursAgo)} ago</span>
            </p>
          )}
          {abandonment.pressureWindowExpiresInGameHours !== undefined &&
            abandonment.recentRaidCount > 0 && (
              <p className="galaxy-intel-line">
                Window reset in: <span className="number">{formatGameHours(abandonment.pressureWindowExpiresInGameHours)}</span>
              </p>
            )}
        </div>
      )}

      {report.resources && (
        <div className="galaxy-intel-block">
          <p className="galaxy-intel-label">Resources</p>
          <p className="galaxy-intel-line number">
            M {formatNumber(report.resources.metal)} | C {formatNumber(report.resources.crystal)} | D{' '}
            {formatNumber(report.resources.deuterium)}
          </p>
        </div>
      )}

      {fleetEntries.length > 0 && (
        <div className="galaxy-intel-block">
          <p className="galaxy-intel-label">Fleet</p>
          {fleetEntries.map((entry) => (
            <p key={entry.id} className="galaxy-intel-line">
              {entry.name}: <span className="number">{formatNumber(entry.count)}</span>
            </p>
          ))}
        </div>
      )}

      {defenceEntries.length > 0 && (
        <div className="galaxy-intel-block">
          <p className="galaxy-intel-label">Defences</p>
          {defenceEntries.map((entry) => (
            <p key={entry.id} className="galaxy-intel-line">
              {entry.name}: <span className="number">{formatNumber(entry.count)}</span>
            </p>
          ))}
        </div>
      )}

      {buildingEntries.length > 0 && (
        <div className="galaxy-intel-block">
          <p className="galaxy-intel-label">Buildings</p>
          {buildingEntries.map((entry) => (
            <p key={entry.id} className="galaxy-intel-line">
              {entry.name}: <span className="number">{entry.count}</span>
            </p>
          ))}
        </div>
      )}

      {report.rebuildStatus && (
        <div className="galaxy-intel-block">
          <p className="galaxy-intel-label">Rebuild Status</p>
          <p className="galaxy-intel-line">
            Defences: <span className="number">{report.rebuildStatus.defencePct}%</span>
          </p>
          <p className="galaxy-intel-line">
            Fleet: <span className="number">{report.rebuildStatus.fleetPct}%</span>
          </p>
        </div>
      )}
    </>
  );
}

interface GalaxyPanelProps {
  onNavigate?: (panel: ActivePanel) => void;
}

export function GalaxyPanel({ onNavigate }: GalaxyPanelProps = {}) {
  const {
    gameState,
    espionageReports,
    colonizeAction,
    setFleetTarget,
    galaxyJumpTarget,
    setGalaxyJumpTarget,
    setPendingMissionTarget,
    dispatchEspionage,
    dispatchHarvest,
    adminForceColonize,
    adminTriggerCombat,
    adminRemoveNPC,
  } = useGame();
  const activePlanetIndex = gameState.activePlanetIndex;
  const [currentSystem, setCurrentSystem] = useState(
    gameState.planets[activePlanetIndex].coordinates.system,
  );
  const [systemDraft, setSystemDraft] = useState(
    String(gameState.planets[activePlanetIndex].coordinates.system),
  );
  const [hoveredNpcKey, setHoveredNpcKey] = useState<string | null>(null);
  const hoverAnchorRef = useRef<HTMLElement | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const clearNpcHoverCloseTimer = () => {
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const scheduleNpcHoverClose = () => {
    clearNpcHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setHoveredNpcKey(null);
      hoverAnchorRef.current = null;
      hoverCloseTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };

  const openNpcHover = (key: string, anchorEl: HTMLElement) => {
    clearNpcHoverCloseTimer();
    hoverAnchorRef.current = anchorEl;
    setHoveredNpcKey(key);
  };

  const clearHoveredNpc = () => {
    clearNpcHoverCloseTimer();
    setHoveredNpcKey(null);
    hoverAnchorRef.current = null;
  };

  function commitSystem(value: string) {
    const n = parseInt(value, 10);
    const clamped = Number.isInteger(n)
      ? Math.min(GALAXY_CONSTANTS.MAX_SYSTEMS, Math.max(1, n))
      : currentSystem;
    setCurrentSystem(clamped);
    setSystemDraft(String(clamped));
    clearHoveredNpc();
  }

  useEffect(() => {
    setSystemDraft(String(currentSystem));
  }, [currentSystem]);

  useEffect(
    () => () => {
      if (hoverCloseTimerRef.current !== null) {
        window.clearTimeout(hoverCloseTimerRef.current);
        hoverCloseTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!galaxyJumpTarget) {
      return;
    }

    setCurrentSystem(galaxyJumpTarget.system);
    setGalaxyJumpTarget(null);
    clearHoveredNpc();
  }, [galaxyJumpTarget, setGalaxyJumpTarget]);

  const slots = getSystemSlots(gameState, 1, currentSystem);
  const debrisByCoord = useMemo(() => {
    const fields = new Map<string, DebrisField>();
    for (const field of gameState.debrisFields) {
      if (field.metal <= 0 && field.crystal <= 0) {
        continue;
      }
      fields.set(coordsKey(field.coordinates), field);
    }
    return fields;
  }, [gameState.debrisFields]);

  const activeMissions = gameState.fleetMissions.filter(
    (mission) => mission.status !== 'completed',
  );
  const slotsFull = activeMissions.length >= calcMaxFleetSlots(gameState.research);
  const activeHarvestTargets = useMemo(() => {
    const targets = new Set<string>();
    for (const mission of activeMissions) {
      if (mission.type !== 'harvest') {
        continue;
      }
      targets.add(coordsKey(mission.targetCoordinates));
    }
    return targets;
  }, [activeMissions]);

  const hasColonyShip = canColonize(gameState);
  const activePlanet = gameState.planets[activePlanetIndex];
  const availableRecyclers = Math.max(0, Math.floor(activePlanet.ships.recycler));
  const availableProbes = Math.min(
    activePlanet.ships.espionageProbe,
    gameState.settings.maxProbeCount,
  );

  const latestReportsByCoords = useMemo(() => {
    const latest = new Map<string, EspionageReport>();
    for (const report of espionageReports) {
      const key = coordsKey(report.targetCoordinates);
      const existing = latest.get(key);
      if (!existing || report.timestamp > existing.timestamp) {
        latest.set(key, report);
      }
    }
    return latest;
  }, [espionageReports]);
  const hoveredReport =
    hoveredNpcKey !== null ? latestReportsByCoords.get(hoveredNpcKey) ?? null : null;

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
          onClick={() => {
            setCurrentSystem((s) => Math.max(1, s - 1));
            clearHoveredNpc();
          }}
        >
          &lt;
        </button>
        <div className="galaxy-coord-group">
          <label className="galaxy-coord-label" htmlFor="galaxy-coord-galaxy">
            Galaxy
          </label>
          <input
            id="galaxy-coord-galaxy"
            type="number"
            className="galaxy-coord-input"
            value={1}
            disabled
            readOnly
          />
          <label className="galaxy-coord-label" htmlFor="galaxy-coord-system">
            System
          </label>
          <input
            id="galaxy-coord-system"
            type="number"
            className="galaxy-coord-input"
            min={1}
            max={GALAXY_CONSTANTS.MAX_SYSTEMS}
            value={systemDraft}
            onChange={(e) => setSystemDraft(e.target.value)}
            onBlur={(e) => commitSystem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitSystem((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          <span className="galaxy-coord-total">/ {GALAXY_CONSTANTS.MAX_SYSTEMS}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={currentSystem >= GALAXY_CONSTANTS.MAX_SYSTEMS}
          onClick={() => {
            setCurrentSystem((s) => Math.min(GALAXY_CONSTANTS.MAX_SYSTEMS, s + 1));
            clearHoveredNpc();
          }}
        >
          &gt;
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
            {slots.map((slot, index) => {
              const targetCoords: Coordinates = { galaxy: 1, system: currentSystem, slot: index + 1 };
              const targetKey = coordsKey(targetCoords);
              const debrisField = debrisByCoord.get(targetKey) ?? null;
              const isActivePlayerSlot =
                slot.type === 'player' &&
                activePlanet.coordinates.galaxy === targetCoords.galaxy &&
                activePlanet.coordinates.system === targetCoords.system &&
                activePlanet.coordinates.slot === targetCoords.slot;

              let harvestDisabledReason: string | null = null;
              if (debrisField) {
                if (availableRecyclers <= 0) {
                  harvestDisabledReason = 'No recyclers on active planet';
                } else if (activeHarvestTargets.has(targetKey)) {
                  harvestDisabledReason = 'Harvest mission already in-flight';
                } else if (slotsFull) {
                  harvestDisabledReason = 'Fleet slots full';
                } else {
                  const totalDebris = Math.max(0, debrisField.metal + debrisField.crystal);
                  const recyclerCount = Math.min(
                    availableRecyclers,
                    Math.ceil(totalDebris / 20_000),
                  );
                  const distance = calcDistance(activePlanet.coordinates, targetCoords);
                  const fuelCost = calcFuelCost({ recycler: recyclerCount }, distance);
                  if (activePlanet.resources.deuterium < fuelCost) {
                    harvestDisabledReason = 'Insufficient deuterium';
                  }
                }
              }

              return (
                <GalaxySlotRow
                  key={index}
                  slot={slot}
                  slotNumber={index + 1}
                  system={currentSystem}
                  hasColonyShip={hasColonyShip}
                  debrisField={debrisField}
                  harvestDisabledReason={harvestDisabledReason}
                  onColonize={colonizeAction}
                  onHarvest={(coords) => {
                    dispatchHarvest(activePlanetIndex, coords);
                  }}
                  onAttackNpc={(coords) => {
                    setFleetTarget(coords);
                    onNavigate?.('fleet');
                  }}
                  showTransportAction={slot.type === 'player' && !isActivePlayerSlot}
                  onTransportPlayer={(coords) => {
                    setFleetTarget(null);
                    setPendingMissionTarget({
                      type: 'transport',
                      coords,
                    });
                    onNavigate?.('fleet');
                  }}
                  onSpyNpc={(coords) => {
                    if (availableProbes <= 0) return;
                    const probeCount = Math.max(1, availableProbes);
                    dispatchEspionage(activePlanetIndex, coords, probeCount);
                  }}
                  onGodColonize={(coords) => {
                    adminForceColonize(coords);
                  }}
                  onGodRaid={(coords) => {
                    adminTriggerCombat(coords, { ...activePlanet.ships });
                  }}
                  onGodDelete={(coords) => {
                    adminRemoveNPC(coords);
                  }}
                  godMode={gameState.settings.godMode}
                  canSpy={availableProbes > 0}
                  onHoverNpc={openNpcHover}
                  onLeaveNpcHover={scheduleNpcHoverClose}
                  playerMilitary={gameState.playerScores.military}
                  now={now}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {!hasColonyShip && (
        <p className="hint galaxy-hint">
          Build a Colony Ship in the Shipyard to colonize empty slots.
        </p>
      )}
      <HoverPortal
        anchorRef={hoverAnchorRef}
        open={hoveredNpcKey !== null}
        align="below-right"
        className="galaxy-spy-hover-panel"
        onMouseEnter={clearNpcHoverCloseTimer}
        onMouseLeave={scheduleNpcHoverClose}
      >
        <EspionageHoverPanel report={hoveredReport} now={now} />
      </HoverPortal>
    </section>
  );
}

function GalaxySlotRow({
  slot,
  slotNumber,
  system,
  hasColonyShip,
  debrisField,
  harvestDisabledReason,
  onColonize,
  onHarvest,
  onAttackNpc,
  showTransportAction,
  onTransportPlayer,
  onSpyNpc,
  onGodColonize,
  onGodRaid,
  onGodDelete,
  godMode,
  canSpy,
  onHoverNpc,
  onLeaveNpcHover,
  playerMilitary,
  now,
}: {
  slot: SystemSlot;
  slotNumber: number;
  system: number;
  hasColonyShip: boolean;
  debrisField: DebrisField | null;
  harvestDisabledReason: string | null;
  onColonize: (coords: Coordinates) => boolean;
  onHarvest: (coords: Coordinates) => void;
  onAttackNpc: (coords: Coordinates) => void;
  showTransportAction: boolean;
  onTransportPlayer: (coords: Coordinates) => void;
  onSpyNpc: (coords: Coordinates) => void;
  onGodColonize: (coords: Coordinates) => void;
  onGodRaid: (coords: Coordinates) => void;
  onGodDelete: (coords: Coordinates) => void;
  godMode: boolean;
  canSpy: boolean;
  onHoverNpc: (key: string, anchorEl: HTMLElement) => void;
  onLeaveNpcHover: () => void;
  playerMilitary: number;
  now: number;
}) {
  const isRebuilding =
    slot.type === 'npc' &&
    (slot.npc?.lastRaidedAt ?? 0) > 0 &&
    now - (slot.npc?.lastRaidedAt ?? 0) < 48 * 3600 * 1000;
  const isAbandoning = slot.type === 'npc' && slot.npc?.abandonedAt !== undefined;

  const targetCoords = { galaxy: 1, system, slot: slotNumber };
  const targetKey = coordsKey(targetCoords);

  return (
    <tr
      className={`galaxy-row-${slot.type} ${slot.type === 'npc' && !isAbandoning ? 'galaxy-row-clickable' : ''} ${isAbandoning ? 'galaxy-row-abandoning' : ''}`}
      onClick={() => {
        if (slot.type === 'npc' && !isAbandoning) {
          onAttackNpc(targetCoords);
        }
      }}
    >
      <td className="number">[1:{system}:{slotNumber}]</td>
      <td>
        {slot.type === 'player' && (
          <span className="galaxy-badge galaxy-badge-player">You</span>
        )}
        {slot.type === 'player' && showTransportAction && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={(event) => {
              event.stopPropagation();
              onTransportPlayer(targetCoords);
            }}
          >
            Transport
          </button>
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
        {slot.type === 'npc' && !isAbandoning && (
          <span className={`galaxy-strength number ${isRebuilding ? 'galaxy-strength-dim' : ''}`}>
            Strength {npcRelativeStrengthLabel(
              calcNPCPower(slot.npc!, now),
              playerMilitary,
            )}
          </span>
        )}
        {isAbandoning && (
          <span className="galaxy-strength galaxy-strength-dim number">Abandoning</span>
        )}
        {isRebuilding && <span className="galaxy-rebuilding">Rebuilding</span>}
        {debrisField && (
          <span className="galaxy-debris number">
            Debris Field M {formatNumber(debrisField.metal)} | C {formatNumber(debrisField.crystal)}
          </span>
        )}
      </td>
      <td className="galaxy-actions-cell">
        {debrisField && (
          <div className="galaxy-actions">
            <button
              type="button"
              className="btn btn-sm"
              disabled={harvestDisabledReason !== null}
              title={harvestDisabledReason ?? 'Dispatch recyclers'}
              onClick={(event) => {
                event.stopPropagation();
                if (harvestDisabledReason !== null) {
                  return;
                }
                onHarvest(targetCoords);
              }}
            >
              Harvest
            </button>
            {harvestDisabledReason && (
              <span className="hint">{harvestDisabledReason}</span>
            )}
          </div>
        )}
        {slot.type === 'npc' && (
          <div
            className="galaxy-actions"
            onMouseEnter={(event) => {
              onHoverNpc(targetKey, event.currentTarget);
            }}
            onMouseLeave={onLeaveNpcHover}
          >
            {!isAbandoning && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAttackNpc(targetCoords);
                  }}
                >
                  Attack
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!canSpy}
                  title={canSpy ? 'Send all available probes' : 'No probes available'}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSpyNpc(targetCoords);
                  }}
                >
                  Spy
                </button>
                {godMode && (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onGodRaid(targetCoords);
                      }}
                    >
                      ⚡ Raid
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onGodDelete(targetCoords);
                      }}
                    >
                      ⚡ Del
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {slot.type === 'empty' && hasColonyShip && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onColonize(targetCoords)}
          >
            Colonize
          </button>
        )}
        {slot.type === 'empty' && godMode && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={(event) => {
              event.stopPropagation();
              onGodColonize(targetCoords);
            }}
          >
            ⚡ Col
          </button>
        )}
      </td>
    </tr>
  );
}
