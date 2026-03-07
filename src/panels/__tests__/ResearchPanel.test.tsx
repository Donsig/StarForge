import userEvent from '@testing-library/user-event';
import { RESEARCH, RESEARCH_ORDER } from '../../data/research.ts';
import { ResearchPanel } from '../ResearchPanel';
import { renderWithGame, screen, within } from '../../test/test-utils';

function getResearchCard(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name, level: 3 });
  const card = heading.closest('article');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

describe('ResearchPanel', () => {
  it('renders all research technologies', () => {
    renderWithGame(<ResearchPanel />);

    for (const researchId of RESEARCH_ORDER) {
      expect(
        screen.getByRole('heading', { name: RESEARCH[researchId].name, level: 3 }),
      ).toBeInTheDocument();
    }
  });

  it('shows each research item name and current level', () => {
    renderWithGame(<ResearchPanel />);

    for (const researchId of RESEARCH_ORDER) {
      const card = getResearchCard(RESEARCH[researchId].name);
      expect(within(card).getByText('Lv 0')).toBeInTheDocument();
    }
  });

  it('disables research when prerequisites are not met', () => {
    renderWithGame(<ResearchPanel />, {
      gameState: {
        planet: {
          buildings: {
            researchLab: 1,
          },
          resources: {
            metal: 1_000_000,
            crystal: 1_000_000,
            deuterium: 1_000_000,
          },
        },
        research: {
          energyTechnology: 1,
        },
      },
    });

    const laserTechnologyCard = getResearchCard('Laser Technology');
    expect(
      within(laserTechnologyCard).getByRole('button', { name: /Research Lv/i }),
    ).toBeDisabled();
  });

  it('allows queuing additional research when the research queue has items', () => {
    renderWithGame(<ResearchPanel />, {
      gameState: {
        planet: {
          buildings: {
            researchLab: 1,
          },
          resources: {
            metal: 1_000_000,
            crystal: 1_000_000,
            deuterium: 1_000_000,
          },
        },
        researchQueue: [
          {
            type: 'research',
            id: 'energyTechnology',
            targetLevel: 1,
            startedAt: Date.now(),
            completesAt: Date.now() + 60_000,
          },
        ],
      },
    });

    const computerTechnologyCard = getResearchCard('Computer Technology');
    expect(
      within(computerTechnologyCard).getByRole('button', { name: /Research Lv/i }),
    ).not.toBeDisabled();
  });

  it('research button shows future level accounting for items already in queue', () => {
    renderWithGame(<ResearchPanel />, {
      gameState: {
        research: { energyTechnology: 3 },
        researchQueue: [
          {
            type: 'research',
            id: 'energyTechnology',
            targetLevel: 4,
            sourcePlanetIndex: 0,
            startedAt: Date.now(),
            completesAt: Date.now() + 60_000,
          },
        ],
        planet: {
          buildings: { researchLab: 1 },
          resources: { metal: 10_000_000, crystal: 10_000_000, deuterium: 10_000_000 },
        },
      },
    });

    expect(screen.getByRole('button', { name: 'Queue Lv 5' })).toBeInTheDocument();
  });

  it('calls startResearchAction with the correct research ID', async () => {
    const user = userEvent.setup();
    const startResearchAction = vi.fn(() => true);

    renderWithGame(<ResearchPanel />, {
      gameState: {
        planet: {
          buildings: {
            researchLab: 1,
          },
          resources: {
            metal: 1_000_000,
            crystal: 1_000_000,
            deuterium: 1_000_000,
          },
        },
      },
      actions: {
        startResearchAction,
      },
    });

    const energyTechnologyCard = getResearchCard('Energy Technology');
    await user.click(
      within(energyTechnologyCard).getByRole('button', { name: /Research Lv 1/i }),
    );

    expect(startResearchAction).toHaveBeenCalledWith('energyTechnology');
  });

  it('enables research when prerequisites are met and resources are sufficient', () => {
    renderWithGame(<ResearchPanel />, {
      gameState: {
        planet: {
          buildings: {
            researchLab: 1,
          },
          resources: {
            metal: 1_000_000,
            crystal: 1_000_000,
            deuterium: 1_000_000,
          },
        },
        research: {
          energyTechnology: 2,
        },
      },
    });

    const laserTechnologyCard = getResearchCard('Laser Technology');
    expect(
      within(laserTechnologyCard).getByRole('button', { name: /Research Lv 1/i }),
    ).toBeEnabled();
  });
});
