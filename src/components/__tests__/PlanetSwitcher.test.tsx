import { PlanetSwitcher } from '../PlanetSwitcher';
import { renderWithGame, screen } from '../../test/test-utils';

describe('PlanetSwitcher', () => {
  it('renders the active planet summary with only one planet', () => {
    renderWithGame(<PlanetSwitcher />);

    expect(screen.getByRole('button', { name: /homeworld/i })).toBeInTheDocument();
    expect(screen.getByText('[1:1:4]')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
