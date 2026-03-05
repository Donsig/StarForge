import userEvent from '@testing-library/user-event';
import { GalaxyPanel } from '../GalaxyPanel';
import { renderWithGame, screen } from '../../test/test-utils';

describe('GalaxyPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders galaxy panel with system navigation', () => {
    renderWithGame(<GalaxyPanel />);
    expect(screen.getByText('Galaxy')).toBeInTheDocument();
    expect(screen.getByText(/System 1/)).toBeInTheDocument();
  });

  it('shows player homeworld in correct slot', () => {
    renderWithGame(<GalaxyPanel />);
    expect(screen.getByText('Homeworld')).toBeInTheDocument();
  });

  it('shows colonize hint when no colony ship available', () => {
    renderWithGame(<GalaxyPanel />);
    expect(screen.getByText(/Build a Colony Ship/)).toBeInTheDocument();
  });

  it('shows NPC strength label and debris indicator on occupied slots', () => {
    vi.spyOn(Date, 'now').mockReturnValue(200_000);

    renderWithGame(<GalaxyPanel />, {
      gameState: {
        galaxy: {
          seed: 1,
          npcColonies: [
            {
              coordinates: { galaxy: 1, system: 1, slot: 1 },
              name: 'Raid Target',
              tier: 8,
              specialty: 'balanced',
              maxTier: 10,
              initialUpgradeIntervalMs: 5_400_000,
              currentUpgradeIntervalMs: 5_400_000,
              lastUpgradeAt: 0,
              upgradeTickCount: 0,
              raidCount: 0,
              recentRaidTimestamps: [],
              abandonedAt: undefined,
              buildings: {},
              baseDefences: {},
              baseShips: {},
              currentDefences: {},
              currentShips: {},
              lastRaidedAt: 150_000,
              resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
            },
          ],
        },
        debrisFields: [{ coordinates: { galaxy: 1, system: 1, slot: 1 }, metal: 100, crystal: 50 }],
      },
    });

    expect(screen.getByText('Strength Strong')).toBeInTheDocument();
    expect(screen.getByText('Rebuilding')).toBeInTheDocument();
    expect(screen.getByText('Debris Field')).toBeInTheDocument();
  });

  it('targets NPC slot and navigates to fleet panel when attack is clicked', async () => {
    const user = userEvent.setup();
    const setFleetTarget = vi.fn();
    const onNavigate = vi.fn();

    renderWithGame(<GalaxyPanel onNavigate={onNavigate} />, {
      gameState: {
        galaxy: {
          seed: 1,
          npcColonies: [
            {
              coordinates: { galaxy: 1, system: 1, slot: 5 },
              name: 'Raid Target',
              tier: 5,
              specialty: 'balanced',
              maxTier: 8,
              initialUpgradeIntervalMs: 10_800_000,
              currentUpgradeIntervalMs: 10_800_000,
              lastUpgradeAt: 0,
              upgradeTickCount: 0,
              raidCount: 0,
              recentRaidTimestamps: [],
              abandonedAt: undefined,
              buildings: {},
              baseDefences: {},
              baseShips: {},
              currentDefences: {},
              currentShips: {},
              lastRaidedAt: 0,
              resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
            },
          ],
        },
      },
      actions: {
        setFleetTarget,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Attack' }));
    expect(setFleetTarget).toHaveBeenCalledWith({ galaxy: 1, system: 1, slot: 5 });
    expect(onNavigate).toHaveBeenCalledWith('fleet');
  });
});
