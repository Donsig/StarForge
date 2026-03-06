/// <reference types="vitest/globals" />
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessagesPanel } from '../MessagesPanel';
import { renderWithGame } from '../../test/test-utils';
import type { CombatLogEntry, FleetNotification } from '../../models/Fleet';

const baseFleetNotification: FleetNotification = {
  id: 'n1',
  missionId: 'm1',
  timestamp: Date.now(),
  missionType: 'transport',
  targetCoordinates: { galaxy: 1, system: 2, slot: 3 },
  targetName: 'Colony Alpha',
  loot: { metal: 0, crystal: 0, deuterium: 0 },
  read: false,
};

describe('MessagesPanel', () => {
  it('renders three tab buttons', () => {
    renderWithGame(<MessagesPanel setActivePanel={() => {}} />);
    expect(screen.getByRole('button', { name: /combat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /espionage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fleet/i })).toBeInTheDocument();
  });

  it('shows empty state when combat log is empty', () => {
    renderWithGame(<MessagesPanel setActivePanel={() => {}} />, { gameState: { combatLog: [] } });
    expect(screen.getByText(/no combat messages/i)).toBeInTheDocument();
  });

  it('shows unread indicator on combat log entry', () => {
    renderWithGame(<MessagesPanel setActivePanel={() => {}} />, {
      gameState: {
        combatLog: [{
          id: 'c1',
          timestamp: Date.now(),
          targetCoordinates: { galaxy: 1, system: 2, slot: 3 },
          result: {
            seed: 0,
            outcome: 'attacker_wins',
            rounds: 2,
            attackerStart: { ships: {} },
            attackerEnd: { ships: {} },
            defenderStart: { ships: {} },
            defenderEnd: { ships: {} },
            attackerLosses: { ships: {} },
            defenderLosses: { ships: {} },
            defencesRebuilt: {},
            debrisCreated: { metal: 0, crystal: 0 },
            loot: { metal: 500, crystal: 200, deuterium: 0 },
          },
          read: false,
        }],
      },
    });
    expect(screen.getByText(/unread/i)).toBeInTheDocument();
  });

  it('calls markAllCombatRead when Mark All Read is clicked', async () => {
    const user = userEvent.setup();
    const markAllCombatRead = vi.fn();
    renderWithGame(<MessagesPanel setActivePanel={() => {}} />, { actions: { markAllCombatRead } });
    await user.click(screen.getByRole('button', { name: /mark all read/i }));
    expect(markAllCombatRead).toHaveBeenCalledOnce();
  });

  it('switches to Espionage tab on click', async () => {
    const user = userEvent.setup();
    renderWithGame(<MessagesPanel setActivePanel={() => {}} />, { gameState: { espionageReports: [] } });
    await user.click(screen.getByRole('button', { name: /espionage/i }));
    expect(screen.getByText(/no espionage messages/i)).toBeInTheDocument();
  });

  it('switches to Fleet tab on click', async () => {
    const user = userEvent.setup();
    renderWithGame(<MessagesPanel setActivePanel={() => {}} />, { gameState: { fleetNotifications: [] } });
    await user.click(screen.getByRole('button', { name: /fleet/i }));
    expect(screen.getByText(/no fleet messages/i)).toBeInTheDocument();
  });

  it('renders coord-link buttons for combat report coordinates', () => {
    const fakeEntry: CombatLogEntry = {
      id: 'test-1',
      timestamp: Date.now(),
      targetCoordinates: { galaxy: 1, system: 5, slot: 3 },
      read: false,
      result: {
        seed: 0,
        outcome: 'attacker_wins',
        rounds: 2,
        attackerStart: { ships: {} },
        attackerEnd: { ships: {} },
        defenderStart: { ships: {}, defences: {} },
        defenderEnd: { ships: {}, defences: {} },
        attackerLosses: { ships: {} },
        defenderLosses: { ships: {}, defences: {} },
        defencesRebuilt: {},
        debrisCreated: { metal: 0, crystal: 0 },
        loot: { metal: 0, crystal: 0, deuterium: 0 },
      },
    };

    const { container } = renderWithGame(
      <MessagesPanel setActivePanel={() => {}} />,
      { gameState: { combatLog: [fakeEntry] } },
    );

    const coordLinks = container.querySelectorAll('.coord-link');
    expect(coordLinks.length).toBeGreaterThan(0);
  });

  describe('fleet notification failure reasons', () => {
    async function renderFleetTab(notification: FleetNotification) {
      const user = userEvent.setup();
      renderWithGame(<MessagesPanel setActivePanel={() => {}} />, {
        gameState: { fleetNotifications: [notification] },
      });
      await user.click(screen.getByRole('button', { name: /fleet/i }));
      // Expand the notification row to reveal the detail / hint text
      await user.click(screen.getByRole('button', { name: /transport to/i }));
      return user;
    }

    it('shows "planet no longer exists" hint when failureReason is planet_missing', async () => {
      await renderFleetTab({
        ...baseFleetNotification,
        failureReason: 'planet_missing',
        targetName: '[G:1 S:2 P:3]',
      });
      expect(screen.getByText(/destination planet no longer exists/i)).toBeInTheDocument();
    });

    it('shows "storage was full" hint when failureReason is storage_full', async () => {
      await renderFleetTab({
        ...baseFleetNotification,
        failureReason: 'storage_full',
      });
      expect(screen.getByText(/storage was full/i)).toBeInTheDocument();
    });

    it('shows "storage was full" hint when zero loot and no failureReason (legacy)', async () => {
      await renderFleetTab({
        ...baseFleetNotification,
      });
      expect(screen.getByText(/storage was full/i)).toBeInTheDocument();
    });
  });
});
