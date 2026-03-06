/// <reference types="vitest/globals" />
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessagesPanel } from '../MessagesPanel';
import { renderWithGame } from '../../test/test-utils';

describe('MessagesPanel', () => {
  it('renders three tab buttons', () => {
    renderWithGame(<MessagesPanel />);
    expect(screen.getByRole('button', { name: /combat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /espionage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fleet/i })).toBeInTheDocument();
  });

  it('shows empty state when combat log is empty', () => {
    renderWithGame(<MessagesPanel />, { gameState: { combatLog: [] } });
    expect(screen.getByText(/no combat messages/i)).toBeInTheDocument();
  });

  it('shows unread indicator on combat log entry', () => {
    renderWithGame(<MessagesPanel />, {
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
    renderWithGame(<MessagesPanel />, { actions: { markAllCombatRead } });
    await user.click(screen.getByRole('button', { name: /mark all read/i }));
    expect(markAllCombatRead).toHaveBeenCalledOnce();
  });

  it('switches to Espionage tab on click', async () => {
    const user = userEvent.setup();
    renderWithGame(<MessagesPanel />, { gameState: { espionageReports: [] } });
    await user.click(screen.getByRole('button', { name: /espionage/i }));
    expect(screen.getByText(/no espionage messages/i)).toBeInTheDocument();
  });

  it('switches to Fleet tab on click', async () => {
    const user = userEvent.setup();
    renderWithGame(<MessagesPanel />, { gameState: { fleetNotifications: [] } });
    await user.click(screen.getByRole('button', { name: /fleet/i }));
    expect(screen.getByText(/no fleet messages/i)).toBeInTheDocument();
  });
});
