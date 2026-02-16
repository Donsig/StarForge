import { PlanetSwitcher } from '../PlanetSwitcher';
import { renderWithGame } from '../../test/test-utils';

describe('PlanetSwitcher', () => {
  it('renders nothing with only one planet', () => {
    const { container } = renderWithGame(<PlanetSwitcher />);
    expect(container.innerHTML).toBe('');
  });
});
