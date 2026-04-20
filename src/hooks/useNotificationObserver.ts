import { useEffect, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext.tsx';
import { useNotifications } from './useNotifications.ts';
import type { MessageTab } from '../context/GameContext.tsx';
import type {
  CombatLogEntry,
  EspionageReport,
  FleetNotification,
  MissionType,
} from '../models/Fleet.ts';

function formatCoords(coords: { galaxy: number; system: number; slot: number }): string {
  return `[${coords.galaxy}:${coords.system}:${coords.slot}]`;
}

function titleCaseMission(missionType: MissionType | FleetNotification['missionType']): string {
  return missionType.charAt(0).toUpperCase() + missionType.slice(1);
}

function getCombatOutcomeLabel(entry: CombatLogEntry): 'Victory' | 'Defeat' | 'Draw' {
  const result = entry.result as CombatLogEntry['result'] & { attackerWon?: boolean };

  if (result.outcome === 'attacker_wins' || result.attackerWon === true) {
    return 'Victory';
  }
  if (result.outcome === 'defender_wins' || result.attackerWon === false) {
    return 'Defeat';
  }
  return 'Draw';
}

function formatCombatMessage(entry: CombatLogEntry): string {
  return `Combat resolved at ${formatCoords(entry.targetCoordinates)} — ${getCombatOutcomeLabel(entry)}`;
}

function formatFleetMessage(notification: FleetNotification): string {
  return `${titleCaseMission(notification.missionType)} mission returned from ${formatCoords(notification.targetCoordinates)}`;
}

function formatEspionageMessage(report: EspionageReport): string {
  return report.detected
    ? `Espionage detected at ${formatCoords(report.targetCoordinates)}`
    : `Espionage report from ${formatCoords(report.targetCoordinates)}`;
}

export function useNotificationObserver() {
  const { gameState, catchUp } = useGame();
  const notifications = useNotifications();
  const initializedRef = useRef(false);
  const lengthsRef = useRef({
    combat: gameState.combatLog.length,
    fleet: gameState.fleetNotifications.length,
    espionage: gameState.espionageReports.length,
  });

  const settings = gameState.settings.notifications;

  const catchUpItems = useMemo(() => {
    const items: Array<{
      id: string;
      timestamp: number;
      type: MessageTab;
      message: string;
    }> = [];

    for (const entry of catchUp?.combat ?? []) {
      if (settings.enabled && settings.combat) {
        items.push({
          id: entry.id,
          timestamp: entry.timestamp,
          type: 'combat',
          message: formatCombatMessage(entry),
        });
      }
    }

    for (const entry of catchUp?.fleet ?? []) {
      if (settings.enabled && settings.fleet) {
        items.push({
          id: entry.id,
          timestamp: entry.timestamp,
          type: 'fleet',
          message: formatFleetMessage(entry),
        });
      }
    }

    for (const entry of catchUp?.espionage ?? []) {
      if (settings.enabled && settings.espionage) {
        items.push({
          id: entry.id,
          timestamp: entry.timestamp,
          type: 'espionage',
          message: formatEspionageMessage(entry),
        });
      }
    }

    return items
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [catchUp, settings.combat, settings.enabled, settings.espionage, settings.fleet]);

  useEffect(() => {
    if (!initializedRef.current) {
      for (const item of catchUpItems) {
        notifications.showToast?.(item.type, item.message, item.type, item.id);
      }

      lengthsRef.current = {
        combat: gameState.combatLog.length,
        fleet: gameState.fleetNotifications.length,
        espionage: gameState.espionageReports.length,
      };
      initializedRef.current = true;
      return;
    }

    const previous = lengthsRef.current;
    const newCombatEntries = gameState.combatLog.slice(previous.combat);
    const newFleetEntries = gameState.fleetNotifications.slice(previous.fleet);
    const newEspionageEntries = gameState.espionageReports.slice(previous.espionage);

    if (settings.enabled && settings.combat) {
      for (const entry of newCombatEntries) {
        notifications.showToast?.('combat', formatCombatMessage(entry), 'combat', entry.id);
      }
    }

    if (settings.enabled && settings.fleet) {
      for (const entry of newFleetEntries) {
        notifications.showToast?.('fleet', formatFleetMessage(entry), 'fleet', entry.id);
      }
    }

    if (settings.enabled && settings.espionage) {
      for (const entry of newEspionageEntries) {
        notifications.showToast?.(
          'espionage',
          formatEspionageMessage(entry),
          'espionage',
          entry.id,
        );
      }
    }

    lengthsRef.current = {
      combat: gameState.combatLog.length,
      fleet: gameState.fleetNotifications.length,
      espionage: gameState.espionageReports.length,
    };
  }, [
    catchUpItems,
    gameState.combatLog,
    gameState.espionageReports,
    gameState.fleetNotifications,
    notifications,
    settings.combat,
    settings.enabled,
    settings.espionage,
    settings.fleet,
  ]);

  return notifications;
}
