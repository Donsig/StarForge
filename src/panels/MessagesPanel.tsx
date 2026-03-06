import { useState } from 'react';
import { DEFENCES } from '../data/defences.ts';
import { SHIPS } from '../data/ships.ts';
import { useGame } from '../context/GameContext';
import type { CombatLogEntry, EspionageReport, FleetNotification } from '../models/Fleet.ts';
import { formatNumber } from '../utils/format.ts';

type MessageTab = 'combat' | 'espionage' | 'fleet';

function formatCoords(coords: { galaxy: number; system: number; slot: number }): string {
  return `${coords.galaxy}:${coords.system}:${coords.slot}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeLosses(units: Partial<Record<string, number>> | undefined): string {
  if (!units) {
    return 'None';
  }

  const segments = Object.entries(units)
    .filter(([, count]) => Math.max(0, Math.floor(count ?? 0)) > 0)
    .map(([id, count]) => `${count}x ${SHIPS[id as keyof typeof SHIPS]?.name ?? DEFENCES[id as keyof typeof DEFENCES]?.name ?? id}`);

  return segments.length > 0 ? segments.join(', ') : 'None';
}

function renderOptionalList(
  title: string,
  units: Partial<Record<string, number>> | undefined,
  names: Record<string, { name: string }>,
  emptyLabel: string,
  unknownLabel: string,
) {
  if (units === undefined) {
    return <p><strong>{title}:</strong> {unknownLabel}</p>;
  }

  const entries = Object.entries(units)
    .filter(([, count]) => Math.max(0, Math.floor(count ?? 0)) > 0)
    .map(([id, count]) => `${count}x ${names[id]?.name ?? id}`);

  return <p><strong>{title}:</strong> {entries.length > 0 ? entries.join(', ') : emptyLabel}</p>;
}

interface RowFrameProps {
  icon: string;
  title: string;
  meta: string[];
  read: boolean;
  onToggle: () => void;
  onDelete: () => void;
  expanded: boolean;
  children: React.ReactNode;
}

function RowFrame({
  icon,
  title,
  meta,
  read,
  onToggle,
  onDelete,
  expanded,
  children,
}: RowFrameProps) {
  return (
    <article className={`message-row ${read ? '' : 'message-unread'}`}>
      <div className="message-row-top">
        <button type="button" className="message-row-toggle" onClick={onToggle}>
          <div className="message-row-summary">
            <span className="message-row-icon">{icon}</span>
            <span className="message-row-text">
              <span className="message-row-title">{title}</span>
              <span className="message-row-meta">
                {meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
                {!read && <span className="message-unread-pill">Unread</span>}
              </span>
            </span>
          </div>
        </button>
        <button type="button" className="btn btn-sm message-delete-btn" onClick={onDelete}>
          Delete
        </button>
      </div>
      {expanded && <div className="message-detail">{children}</div>}
    </article>
  );
}

function CombatMessageRow({
  entry,
  onRead,
  onDelete,
}: {
  entry: CombatLogEntry;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const outcome =
    entry.result.outcome === 'attacker_wins'
      ? 'Victory'
      : entry.result.outcome === 'defender_wins'
        ? 'Defeat'
        : 'Draw';

  const handleToggle = () => {
    setExpanded((current) => !current);
    if (!entry.read) {
      onRead(entry.id);
    }
  };

  return (
    <RowFrame
      icon="CMB"
      title={`${outcome} at [${formatCoords(entry.targetCoordinates)}]`}
      meta={[
        `${entry.result.rounds} rounds`,
        `Loot M ${formatNumber(entry.result.loot.metal)} C ${formatNumber(entry.result.loot.crystal)} D ${formatNumber(entry.result.loot.deuterium)}`,
        formatDate(entry.timestamp),
      ]}
      read={entry.read}
      onToggle={handleToggle}
      onDelete={() => onDelete(entry.id)}
      expanded={expanded}
    >
      <p><strong>Outcome:</strong> {outcome}</p>
      <p><strong>Attacker losses:</strong> {summarizeLosses(entry.result.attackerLosses.ships)}</p>
      <p><strong>Defender fleet losses:</strong> {summarizeLosses(entry.result.defenderLosses.ships)}</p>
      <p><strong>Defender defence losses:</strong> {summarizeLosses(entry.result.defenderLosses.defences)}</p>
      <p>
        <strong>Debris:</strong> M {formatNumber(entry.result.debrisCreated.metal)} C {formatNumber(entry.result.debrisCreated.crystal)}
      </p>
    </RowFrame>
  );
}

function EspionageMessageRow({
  report,
  onRead,
  onDelete,
}: {
  report: EspionageReport;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    setExpanded((current) => !current);
    if (!report.read) {
      onRead(report.id);
    }
  };

  const resourceSummary = report.resources
    ? `Res M ${formatNumber(report.resources.metal)} C ${formatNumber(report.resources.crystal)} D ${formatNumber(report.resources.deuterium)}`
    : 'Resources unknown';

  return (
    <RowFrame
      icon="ESP"
      title={`${report.targetName} [${formatCoords(report.targetCoordinates)}]`}
      meta={[
        report.detected ? 'Detected' : resourceSummary,
        `Counter chance ${(report.detectionChance * 100).toFixed(1)}%`,
        formatDate(report.timestamp),
      ]}
      read={report.read}
      onToggle={handleToggle}
      onDelete={() => onDelete(report.id)}
      expanded={expanded}
    >
      {report.detected && (
        <p className="hint danger">
          Probes destroyed: {report.probesLost}/{report.probesSent}
        </p>
      )}
      {report.resources ? (
        <p>
          <strong>Resources:</strong> M {formatNumber(report.resources.metal)} C {formatNumber(report.resources.crystal)} D {formatNumber(report.resources.deuterium)}
        </p>
      ) : (
        <p><strong>Resources:</strong> Unknown</p>
      )}
      {renderOptionalList('Fleet', report.fleet, SHIPS, 'None', 'Unknown')}
      {renderOptionalList('Defences', report.defences, DEFENCES, 'None', 'Unknown')}
      {report.tier !== undefined && (
        <p><strong>Colony tier:</strong> {report.tier}{report.specialty ? ` (${report.specialty})` : ''}</p>
      )}
      {report.rebuildStatus && (
        <p><strong>Rebuild status:</strong> Fleet {report.rebuildStatus.fleetPct}% | Defence {report.rebuildStatus.defencePct}%</p>
      )}
    </RowFrame>
  );
}

function FleetMessageRow({
  notification,
  onRead,
  onDelete,
}: {
  notification: FleetNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isEmpty =
    notification.loot.metal <= 0 &&
    notification.loot.crystal <= 0 &&
    notification.loot.deuterium <= 0;

  const handleToggle = () => {
    setExpanded((current) => !current);
    if (!notification.read) {
      onRead(notification.id);
    }
  };

  return (
    <RowFrame
      icon="FLT"
      title={
        notification.missionType === 'transport'
          ? `Transport to ${notification.targetName}`
          : `Harvest at ${notification.targetName}`
      }
      meta={[
        `[${formatCoords(notification.targetCoordinates)}]`,
        `M ${formatNumber(notification.loot.metal)} C ${formatNumber(notification.loot.crystal)} D ${formatNumber(notification.loot.deuterium)}`,
        formatDate(notification.timestamp),
      ]}
      read={notification.read}
      onToggle={handleToggle}
      onDelete={() => onDelete(notification.id)}
      expanded={expanded}
    >
      <p><strong>Target:</strong> {notification.targetName}</p>
      {isEmpty ? (
        <p className="hint">
          {notification.missionType === 'harvest'
            ? 'No recoverable debris remained at arrival.'
            : notification.failureReason === 'planet_missing'
              ? 'Destination planet no longer exists.'
              : 'Destination planet storage was full — nothing could be delivered.'}
        </p>
      ) : (
        <p>
          <strong>Resources:</strong> M {formatNumber(notification.loot.metal)} C {formatNumber(notification.loot.crystal)} D {formatNumber(notification.loot.deuterium)}
        </p>
      )}
    </RowFrame>
  );
}

export function MessagesPanel() {
  const {
    gameState,
    fleetNotifications,
    markCombatRead,
    markAllCombatRead,
    markEspionageRead,
    markAllEspionageRead,
    markFleetRead,
    markAllFleetRead,
    deleteCombatEntry,
    deleteEspionageReport,
    deleteFleetNotification,
  } = useGame();
  const [activeTab, setActiveTab] = useState<MessageTab>('combat');

  const combatEntries = [...gameState.combatLog].sort((a, b) => b.timestamp - a.timestamp);
  const espionageEntries = [...gameState.espionageReports].sort((a, b) => b.timestamp - a.timestamp);
  const fleetEntries = [...fleetNotifications].sort((a, b) => b.timestamp - a.timestamp);

  const combatUnread = gameState.combatLog.filter((entry) => !entry.read).length;
  const espionageUnread = gameState.espionageReports.filter((report) => !report.read).length;
  const fleetUnread = fleetNotifications.filter((notification) => !notification.read).length;

  return (
    <section className="panel">
      <h1 className="panel-title">Messages</h1>

      <div className="messages-tabs">
        <button
          type="button"
          className={`btn messages-tab-btn ${activeTab === 'combat' ? 'active' : ''}`}
          onClick={() => setActiveTab('combat')}
        >
          Combat
          {combatUnread > 0 && <span className="nav-badge">{combatUnread}</span>}
        </button>
        <button
          type="button"
          className={`btn messages-tab-btn ${activeTab === 'espionage' ? 'active' : ''}`}
          onClick={() => setActiveTab('espionage')}
        >
          Espionage
          {espionageUnread > 0 && <span className="nav-badge">{espionageUnread}</span>}
        </button>
        <button
          type="button"
          className={`btn messages-tab-btn ${activeTab === 'fleet' ? 'active' : ''}`}
          onClick={() => setActiveTab('fleet')}
        >
          Fleet
          {fleetUnread > 0 && <span className="nav-badge">{fleetUnread}</span>}
        </button>
      </div>

      <div className="panel-card">
        {activeTab === 'combat' && (
          <>
            <div className="messages-tab-header">
              <h2 className="section-title">Combat Reports</h2>
              <button type="button" className="btn btn-sm" onClick={markAllCombatRead}>
                Mark All Read
              </button>
            </div>
            {combatEntries.length === 0 ? (
              <p className="hint">No combat messages</p>
            ) : (
              <div className="messages-list">
                {combatEntries.map((entry) => (
                  <CombatMessageRow
                    key={entry.id}
                    entry={entry}
                    onRead={markCombatRead}
                    onDelete={deleteCombatEntry}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'espionage' && (
          <>
            <div className="messages-tab-header">
              <h2 className="section-title">Espionage Reports</h2>
              <button type="button" className="btn btn-sm" onClick={markAllEspionageRead}>
                Mark All Read
              </button>
            </div>
            {espionageEntries.length === 0 ? (
              <p className="hint">No espionage messages</p>
            ) : (
              <div className="messages-list">
                {espionageEntries.map((report) => (
                  <EspionageMessageRow
                    key={report.id}
                    report={report}
                    onRead={markEspionageRead}
                    onDelete={deleteEspionageReport}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'fleet' && (
          <>
            <div className="messages-tab-header">
              <h2 className="section-title">Fleet Notifications</h2>
              <button type="button" className="btn btn-sm" onClick={markAllFleetRead}>
                Mark All Read
              </button>
            </div>
            {fleetEntries.length === 0 ? (
              <p className="hint">No fleet messages</p>
            ) : (
              <div className="messages-list">
                {fleetEntries.map((notification) => (
                  <FleetMessageRow
                    key={notification.id}
                    notification={notification}
                    onRead={markFleetRead}
                    onDelete={deleteFleetNotification}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
