import { GalaxyPanel } from '../GalaxyPanel';
import { renderWithGame, screen } from '../../test/test-utils';

describe('GalaxyPanel', () => {
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
});
