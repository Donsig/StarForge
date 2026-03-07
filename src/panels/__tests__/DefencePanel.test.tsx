import userEvent from '@testing-library/user-event';
import { DefencePanel } from '../DefencePanel';
import { renderWithGame, screen, within } from '../../test/test-utils';

describe('DefencePanel', () => {
  it('renders panel banner with defence.webp src', () => {
    renderWithGame(<DefencePanel />, {
      gameState: { planet: { buildings: { shipyard: 1 } } },
    });

    const banner = document.querySelector('.panel-banner img') as HTMLImageElement | null;
    expect(banner).not.toBeNull();
    expect(banner!.src).toContain('defence.webp');
  });

  it('Max button sets quantity to max affordable count', async () => {
    const user = userEvent.setup();

    renderWithGame(<DefencePanel />, {
      gameState: {
        planet: {
          buildings: { shipyard: 1 },
          resources: { metal: 24_000, crystal: 8_000, deuterium: 0 },
        },
      },
    });

    const heading = screen.getByRole('heading', { name: 'Rocket Launcher', level: 3 });
    const card = heading.closest('article');
    expect(card).not.toBeNull();

    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Max' }));

    expect(within(card as HTMLElement).getByRole('spinbutton')).toHaveValue(12);
  });

  it('Max button caps at remainingMax for limited defences', async () => {
    const user = userEvent.setup();

    renderWithGame(<DefencePanel />, {
      gameState: {
        planet: {
          buildings: { shipyard: 2 },
          resources: { metal: 10_000_000, crystal: 10_000_000, deuterium: 10_000_000 },
        },
        research: { shieldingTechnology: 2 },
      },
    });

    const heading = screen.getByRole('heading', { name: 'Small Shield Dome', level: 3 });
    const card = heading.closest('article');
    expect(card).not.toBeNull();

    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Max' }));

    expect(within(card as HTMLElement).getByRole('spinbutton')).toHaveValue(1);
  });

  it('renders card banner imgs for defence cards', () => {
    renderWithGame(<DefencePanel />, {
      gameState: { planet: { buildings: { shipyard: 1 } } },
    });

    const images = document.querySelectorAll('.card-banner img');
    expect(images.length).toBeGreaterThan(0);
    const srcs = Array.from(images).map((image) => (image as HTMLImageElement).src);
    expect(srcs.some((src) => src.includes('rocketLauncher.webp'))).toBe(true);
  });
});
