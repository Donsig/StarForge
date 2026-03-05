import userEvent from '@testing-library/user-event';
import { GalaxyPanel } from '../GalaxyPanel';
import { renderWithGame, screen } from '../../test/test-utils';
import { dispatchHarvest as dispatchHarvestMission } from '../../engine/FleetEngine.ts';
import type { GameState } from '../../models/GameState.ts';
import type { Coordinates } from '../../models/Galaxy.ts';

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

  it('shows Transport button on player-owned slots that are not the active planet', () => {
    renderWithGame(<GalaxyPanel />, { withMultiplePlanets: true });
    expect(screen.getByRole('button', { name: 'Transport' })).toBeInTheDocument();
  });

  it('shows colonize hint when no colony ship available', () => {
    renderWithGame(<GalaxyPanel />);
    expect(screen.getByText(/Build a Colony Ship/)).toBeInTheDocument();
  });

  it('shows NPC strength label and debris indicator with formatted debris amounts', () => {
    vi.spyOn(Date, 'now').mockReturnValue(200_000);

    renderWithGame(<GalaxyPanel />, {
      gameState: {
        galaxy: {
          seed: 1,
          npcColonies: [
            {
              coordinates: { galaxy: 1, system: 1, slot: 1 },
              name: 'Raid Target',
              temperature: 30,
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
        debrisFields: [{ coordinates: { galaxy: 1, system: 1, slot: 1 }, metal: 12_345, crystal: 6_789 }],
      },
    });

    expect(screen.getByText('Strength Strong')).toBeInTheDocument();
    expect(screen.getByText('Rebuilding')).toBeInTheDocument();
    expect(screen.getByText('Debris Field M 12,345 | C 6,789')).toBeInTheDocument();
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
              temperature: 22,
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

  it('prefills transport mission target and navigates to fleet panel', async () => {
    const user = userEvent.setup();
    const setPendingMissionTarget = vi.fn();
    const setFleetTarget = vi.fn();
    const onNavigate = vi.fn();

    renderWithGame(<GalaxyPanel onNavigate={onNavigate} />, {
      withMultiplePlanets: true,
      actions: {
        setPendingMissionTarget,
        setFleetTarget,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Transport' }));

    expect(setFleetTarget).toHaveBeenCalledWith(null);
    expect(setPendingMissionTarget).toHaveBeenCalledWith({
      type: 'transport',
      coords: { galaxy: 1, system: 1, slot: 5 },
    });
    expect(onNavigate).toHaveBeenCalledWith('fleet');
  });

  it('dispatches harvest missions and auto-calculates recycler count', async () => {
    const user = userEvent.setup();
    let gameStateRef: GameState | null = null;
    const dispatchHarvest = vi.fn((sourcePlanetIndex: number, coords: Coordinates) => {
      if (!gameStateRef) {
        return null;
      }
      return dispatchHarvestMission(gameStateRef, sourcePlanetIndex, coords);
    });

    const { gameContext } = renderWithGame(<GalaxyPanel />, {
      gameState: {
        planet: {
          ships: { recycler: 5 },
          resources: { deuterium: 10_000 },
        },
        debrisFields: [{ coordinates: { galaxy: 1, system: 1, slot: 6 }, metal: 30_000, crystal: 15_000 }],
      },
      actions: {
        dispatchHarvest,
      },
    });
    gameStateRef = gameContext.gameState;

    await user.click(screen.getByRole('button', { name: 'Harvest' }));

    expect(dispatchHarvest).toHaveBeenCalledWith(0, { galaxy: 1, system: 1, slot: 6 });
    const harvestMission = gameStateRef?.fleetMissions.find(
      (mission) => mission.type === 'harvest',
    );
    expect(harvestMission?.ships.recycler).toBe(3);
  });

  it('disables harvest button when no recyclers are available', () => {
    renderWithGame(<GalaxyPanel />, {
      gameState: {
        planet: {
          ships: { recycler: 0 },
          resources: { deuterium: 10_000 },
        },
        debrisFields: [{ coordinates: { galaxy: 1, system: 1, slot: 6 }, metal: 10_000, crystal: 5_000 }],
      },
    });

    expect(screen.getByRole('button', { name: 'Harvest' })).toBeDisabled();
    expect(screen.getByText('No recyclers on active planet')).toBeInTheDocument();
  });
});
