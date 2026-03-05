import { useMemo, useState } from 'react';
import type { EspionageReport } from '../models/Fleet.ts';
import { useGame } from '../context/GameContext';
import { GALAXY_CONSTANTS } from '../data/galaxy.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { SHIPS } from '../data/ships.ts';
import { getSystemSlots, canColonize, type SystemSlot } from '../engine/GalaxyEngine.ts';
import type { Coordinates } from '../models/Galaxy.ts';
import type { ActivePanel } from '../models/types.ts';
import { formatNumber } from '../utils/format.ts';

function npcStrengthLabel(tier: number): string {
  if (tier <= 3) return 'Weak';
  if (tier <= 6) return 'Medium';
  if (tier <= 8) return 'Strong';
  return 'Massive';
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
      <div className="galaxy-spy-hover-panel">
        <p className="galaxy-intel-empty">No intelligence — send probes to gather data</p>
      </div>
    );
  }

  if (report.detected) {
    return (
      <div className="galaxy-spy-hover-panel">
        <p className="galaxy-intel-title">Probes detected — last spy attempt failed</p>
        <p className="galaxy-intel-meta">{formatScannedAgo(report.timestamp, now)}</p>
      </div>
    );
  }

  const fleetEntries = listEntries(report.fleet, unitName);
  const defenceEntries = listEntries(report.defences, defenceName);
  const buildingEntries = listEntries(report.buildings, buildingName);

  return (
    <div className="galaxy-spy-hover-panel">
      <div className="galaxy-intel-header">
        <strong>{report.targetName}</strong>
        {report.tier !== undefined && (
          <span className="galaxy-intel-tier number">Tier {report.tier}</span>
        )}
      </div>

      <p className="galaxy-intel-meta">{formatScannedAgo(report.timestamp, now)}</p>

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
    </div>
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
    dispatchEspionage,
    adminForceColonize,
    adminTriggerCombat,
    adminRemoveNPC,
  } = useGame();
  const [currentSystem, setCurrentSystem] = useState(
    gameState.planets[gameState.activePlanetIndex].coordinates.system,
  );
  const [hoveredNpcCoords, setHoveredNpcCoords] = useState<Coordinates | null>(null);
  const now = Date.now();

  const slots = getSystemSlots(gameState, 1, currentSystem);
  const debrisSlots = new Set(
    gameState.debrisFields
      .filter(
        (field) =>
          field.coordinates.galaxy === 1 &&
          field.coordinates.system === currentSystem &&
          (field.metal > 0 || field.crystal > 0),
      )
      .map((field) => field.coordinates.slot),
  );
  const hasColonyShip = canColonize(gameState);
  const activePlanet = gameState.planets[gameState.activePlanetIndex];
  const availableProbes = activePlanet.ships.espionageProbe;

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
            setHoveredNpcCoords(null);
          }}
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
          onClick={() => {
            setCurrentSystem((s) => Math.min(GALAXY_CONSTANTS.MAX_SYSTEMS, s + 1));
            setHoveredNpcCoords(null);
          }}
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
            {slots.map((slot, index) => {
              const targetCoords: Coordinates = { galaxy: 1, system: currentSystem, slot: index + 1 };
              const report = latestReportsByCoords.get(coordsKey(targetCoords)) ?? null;

              return (
                <GalaxySlotRow
                  key={index}
                  slot={slot}
                  slotNumber={index + 1}
                  system={currentSystem}
                  hasColonyShip={hasColonyShip}
                  hasDebris={debrisSlots.has(index + 1)}
                  onColonize={colonizeAction}
                  onAttackNpc={(coords) => {
                    setFleetTarget(coords);
                    onNavigate?.('fleet');
                  }}
                  onSpyNpc={(coords) => {
                    if (availableProbes <= 0) return;
                    const probeCount = Math.max(1, availableProbes);
                    dispatchEspionage(gameState.activePlanetIndex, coords, probeCount);
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
                  hoveredNpcCoords={hoveredNpcCoords}
                  onHoverNpc={setHoveredNpcCoords}
                  latestReport={report}
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
    </section>
  );
}

function GalaxySlotRow({
  slot,
  slotNumber,
  system,
  hasColonyShip,
  hasDebris,
  onColonize,
  onAttackNpc,
  onSpyNpc,
  onGodColonize,
  onGodRaid,
  onGodDelete,
  godMode,
  canSpy,
  hoveredNpcCoords,
  onHoverNpc,
  latestReport,
  now,
}: {
  slot: SystemSlot;
  slotNumber: number;
  system: number;
  hasColonyShip: boolean;
  hasDebris: boolean;
  onColonize: (coords: Coordinates) => boolean;
  onAttackNpc: (coords: Coordinates) => void;
  onSpyNpc: (coords: Coordinates) => void;
  onGodColonize: (coords: Coordinates) => void;
  onGodRaid: (coords: Coordinates) => void;
  onGodDelete: (coords: Coordinates) => void;
  godMode: boolean;
  canSpy: boolean;
  hoveredNpcCoords: Coordinates | null;
  onHoverNpc: (coords: Coordinates | null) => void;
  latestReport: EspionageReport | null;
  now: number;
}) {
  const isRebuilding =
    slot.type === 'npc' &&
    (slot.npc?.lastRaidedAt ?? 0) > 0 &&
    now - (slot.npc?.lastRaidedAt ?? 0) < 48 * 3600 * 1000;

  const targetCoords = { galaxy: 1, system, slot: slotNumber };
  const isHovered =
    hoveredNpcCoords?.galaxy === targetCoords.galaxy &&
    hoveredNpcCoords?.system === targetCoords.system &&
    hoveredNpcCoords?.slot === targetCoords.slot;

  return (
    <tr
      className={`galaxy-row-${slot.type} ${slot.type === 'npc' ? 'galaxy-row-clickable' : ''}`}
      onClick={() => {
        if (slot.type === 'npc') {
          onAttackNpc(targetCoords);
        }
      }}
      onMouseEnter={() => {
        if (slot.type === 'npc') {
          onHoverNpc(targetCoords);
        }
      }}
      onMouseLeave={() => {
        if (slot.type === 'npc') {
          onHoverNpc(null);
        }
      }}
    >
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
          <span className={`galaxy-strength number ${isRebuilding ? 'galaxy-strength-dim' : ''}`}>
            Strength {npcStrengthLabel(slot.npc?.tier ?? 1)}
          </span>
        )}
        {isRebuilding && <span className="galaxy-rebuilding">Rebuilding</span>}
        {hasDebris && <span className="galaxy-debris number">Debris Field</span>}
      </td>
      <td className="galaxy-actions-cell">
        {slot.type === 'npc' && (
          <div className="galaxy-actions">
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
            {isHovered && <EspionageHoverPanel report={latestReport} now={now} />}
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
