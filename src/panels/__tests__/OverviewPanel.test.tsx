/// <reference types="vitest/globals" />

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverviewPanel } from '../OverviewPanel';
import { renderWithGame } from '../../test/test-utils';

describe('OverviewPanel planet rename', () => {
  it('shows planet name and a rename button', () => {
    renderWithGame(<OverviewPanel />);

    expect(screen.getByText('Homeworld')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename planet/i })).toBeInTheDocument();
  });

  it('clicking rename button shows an input with the current name', async () => {
    const user = userEvent.setup();
    renderWithGame(<OverviewPanel />);

    await user.click(screen.getByRole('button', { name: /rename planet/i }));

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Homeworld');
  });

  it('pressing Escape cancels without saving', async () => {
    const user = userEvent.setup();
    const renamePlanet = vi.fn();
    renderWithGame(<OverviewPanel />, { actions: { renamePlanet } });

    await user.click(screen.getByRole('button', { name: /rename planet/i }));
    await user.keyboard('{Escape}');

    expect(renamePlanet).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('pressing Enter saves the name and exits edit mode', async () => {
    const user = userEvent.setup();
    const renamePlanet = vi.fn();
    renderWithGame(<OverviewPanel />, { actions: { renamePlanet } });

    await user.click(screen.getByRole('button', { name: /rename planet/i }));

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New Name{Enter}');

    expect(renamePlanet).toHaveBeenCalledWith(0, 'New Name');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('blur also saves the name', async () => {
    const user = userEvent.setup();
    const renamePlanet = vi.fn();
    renderWithGame(<OverviewPanel />, { actions: { renamePlanet } });

    await user.click(screen.getByRole('button', { name: /rename planet/i }));

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Blurred Name');
    await user.tab();

    expect(renamePlanet).toHaveBeenCalledWith(0, 'Blurred Name');
  });

  it('renders planet portrait img with correct type src based on temperature', () => {
    renderWithGame(<OverviewPanel />, {
      gameState: {
        planet: { maxTemperature: 80 },
      },
    });

    const portrait = document.querySelector('.planet-portrait img') as HTMLImageElement | null;
    expect(portrait).toBeTruthy();
    expect(portrait?.src).toContain('hot.webp');
  });
});
