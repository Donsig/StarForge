import userEvent from '@testing-library/user-event';
import { BUILDINGS, BUILDING_ORDER } from '../../data/buildings.ts';
import { BuildingsPanel } from '../BuildingsPanel';
import { renderWithGame, screen, within } from '../../test/test-utils';

function getBuildingCard(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name, level: 3 });
  const card = heading.closest('article');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

function getSolarSatelliteCard(): HTMLElement {
  return getBuildingCard('Solar Satellites');
}

describe('BuildingsPanel', () => {
  it('renders all buildings from BUILDING_ORDER with names', () => {
    renderWithGame(<BuildingsPanel />);

    for (const buildingId of BUILDING_ORDER) {
      expect(
        screen.getByRole('heading', { name: BUILDINGS[buildingId].name, level: 3 }),
      ).toBeInTheDocument();
    }
  });

  it('shows current level and an upgrade button for each building', () => {
    renderWithGame(<BuildingsPanel />);

    for (const buildingId of BUILDING_ORDER) {
      const card = getBuildingCard(BUILDINGS[buildingId].name);
      expect(within(card).getByText('Lv 0')).toBeInTheDocument();
      expect(
        within(card).getByRole('button', { name: /Upgrade to Lv 1/i }),
      ).toBeInTheDocument();
    }
  });

  it('disables upgrade buttons when resources are insufficient', () => {
    renderWithGame(<BuildingsPanel />, {
      gameState: {
        planet: {
          resources: {
            metal: 0,
            crystal: 0,
            deuterium: 0,
          },
        },
      },
    });

    const metalMineCard = getBuildingCard('Metal Mine');
    expect(
      within(metalMineCard).getByRole('button', { name: /Upgrade to Lv 1/i }),
    ).toBeDisabled();
  });

  it('allows queuing additional buildings when the building queue has items', () => {
    renderWithGame(<BuildingsPanel />, {
      gameState: {
        planet: {
          resources: {
            metal: 1_000_000,
            crystal: 1_000_000,
            deuterium: 1_000_000,
          },
          buildingQueue: [
            {
              type: 'building',
              id: 'metalMine',
              targetLevel: 1,
              startedAt: Date.now(),
              completesAt: Date.now() + 60_000,
            },
          ],
        },
      },
    });

    const crystalMineCard = getBuildingCard('Crystal Mine');
    expect(
      within(crystalMineCard).getByRole('button', { name: /Upgrade to Lv 1/i }),
    ).not.toBeDisabled();
  });

  it('upgrade button shows future level accounting for items already in queue', () => {
    renderWithGame(<BuildingsPanel />, {
      gameState: {
        planet: {
          buildings: { metalMine: 5 },
          buildingQueue: [
            {
              type: 'building',
              id: 'metalMine',
              targetLevel: 6,
              startedAt: Date.now(),
              completesAt: Date.now() + 60_000,
            },
            {
              type: 'building',
              id: 'metalMine',
              targetLevel: 7,
              startedAt: Date.now() + 60_000,
              completesAt: Date.now() + 120_000,
            },
          ],
          resources: { metal: 10_000_000, crystal: 10_000_000, deuterium: 10_000_000 },
        },
      },
    });

    expect(screen.getByRole('button', { name: 'Queue Lv 8' })).toBeInTheDocument();
  });

  it('calls upgradeBuilding with the correct building ID', async () => {
    const user = userEvent.setup();
    const upgradeBuilding = vi.fn(() => true);

    renderWithGame(<BuildingsPanel />, {
      gameState: {
        planet: {
          resources: {
            metal: 1_000_000,
            crystal: 1_000_000,
            deuterium: 1_000_000,
          },
        },
      },
      actions: {
        upgradeBuilding,
      },
    });

    const metalMineCard = getBuildingCard('Metal Mine');
    await user.click(
      within(metalMineCard).getByRole('button', { name: /Upgrade to Lv 1/i }),
    );

    expect(upgradeBuilding).toHaveBeenCalledWith('metalMine');
  });

  it('shows requirement text for buildings with unmet prerequisites', () => {
    renderWithGame(<BuildingsPanel />);

    const fusionReactorCard = getBuildingCard('Fusion Reactor');
    expect(
      within(fusionReactorCard).getByText('Deuterium Synthesizer 5'),
    ).toBeInTheDocument();
    expect(
      within(fusionReactorCard).getByText('Energy Technology 3'),
    ).toBeInTheDocument();
  });

  it('shows met and unmet prerequisite classes correctly', () => {
    renderWithGame(<BuildingsPanel />, {
      gameState: {
        planet: {
          buildings: {
            deuteriumSynthesizer: 5,
          },
        },
        research: {
          energyTechnology: 2,
        },
      },
    });

    const fusionReactorCard = getBuildingCard('Fusion Reactor');
    expect(
      within(fusionReactorCard).getByText('Deuterium Synthesizer 5'),
    ).toHaveClass('met');
    expect(
      within(fusionReactorCard).getByText('Energy Technology 3'),
    ).toHaveClass('unmet');
  });

  it('shows solar satellite stats in the energy subsection', () => {
    renderWithGame(<BuildingsPanel />, {
      gameState: {
        planet: {
          maxTemperature: 50,
          ships: {
            solarSatellite: 7,
          },
        },
      },
    });

    const satelliteCard = getSolarSatelliteCard();
    expect(within(satelliteCard).getByText('Owned: 7')).toBeInTheDocument();
    expect(within(satelliteCard).getAllByText('C 2,000')).toHaveLength(2);
    expect(within(satelliteCard).getAllByText('D 500')).toHaveLength(2);
    expect(within(satelliteCard).getByText(/^31$/)).toBeInTheDocument();
  });

  it('locks solar satellite build when shipyard is below level 1', () => {
    renderWithGame(<BuildingsPanel />, {
      gameState: {
        planet: {
          buildings: {
            shipyard: 0,
          },
        },
      },
    });

    const satelliteCard = getSolarSatelliteCard();
    expect(within(satelliteCard).getByRole('button', { name: 'Locked' })).toBeDisabled();
    expect(within(satelliteCard).getByText('Shipyard 1')).toHaveClass('unmet');
  });

  it('calls buildShips for solar satellites with selected quantity', async () => {
    const user = userEvent.setup();
    const buildShips = vi.fn(() => true);

    renderWithGame(<BuildingsPanel />, {
      gameState: {
        planet: {
          buildings: {
            shipyard: 1,
          },
          resources: {
            metal: 100_000,
            crystal: 100_000,
            deuterium: 100_000,
          },
        },
      },
      actions: {
        buildShips,
      },
    });

    const satelliteCard = getSolarSatelliteCard();
    const quantityInput = within(satelliteCard).getByRole('spinbutton');

    await user.clear(quantityInput);
    await user.type(quantityInput, '4');
    await user.click(within(satelliteCard).getByRole('button', { name: 'Build' }));

    expect(buildShips).toHaveBeenCalledWith('solarSatellite', 4);
  });
});
