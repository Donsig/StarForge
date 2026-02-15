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

  it('disables upgrade buttons when the building queue is occupied', () => {
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
    ).toBeDisabled();
    expect(within(crystalMineCard).getByText('Building queue occupied')).toBeInTheDocument();
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
});
