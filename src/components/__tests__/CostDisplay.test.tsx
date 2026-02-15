import { CostDisplay } from '../CostDisplay';
import { render, screen } from '../../test/test-utils';

describe('CostDisplay', () => {
  it('displays metal, crystal, and deuterium cost values', () => {
    render(
      <CostDisplay
        cost={{ metal: 1234, crystal: 5678, deuterium: 90 }}
        available={{
          metal: 10000,
          crystal: 10000,
          deuterium: 10000,
          energyProduction: 0,
          energyConsumption: 0,
        }}
      />,
    );

    expect(screen.getByText('M 1,234')).toBeInTheDocument();
    expect(screen.getByText('C 5,678')).toBeInTheDocument();
    expect(screen.getByText('D 90')).toBeInTheDocument();
  });

  it('marks all cost values as insufficient when the player cannot afford them', () => {
    render(
      <CostDisplay
        cost={{ metal: 100, crystal: 200, deuterium: 300 }}
        available={{
          metal: 0,
          crystal: 0,
          deuterium: 0,
          energyProduction: 0,
          energyConsumption: 0,
        }}
      />,
    );

    expect(screen.getByText('M 100')).toHaveClass('insufficient');
    expect(screen.getByText('C 200')).toHaveClass('insufficient');
    expect(screen.getByText('D 300')).toHaveClass('insufficient');
  });

  it('does not mark cost values as insufficient when the player can afford them', () => {
    render(
      <CostDisplay
        cost={{ metal: 100, crystal: 200, deuterium: 300 }}
        available={{
          metal: 100,
          crystal: 200,
          deuterium: 300,
          energyProduction: 0,
          energyConsumption: 0,
        }}
      />,
    );

    expect(screen.getByText('M 100')).not.toHaveClass('insufficient');
    expect(screen.getByText('C 200')).not.toHaveClass('insufficient');
    expect(screen.getByText('D 300')).not.toHaveClass('insufficient');
  });

  it('styles mixed affordability per resource independently', () => {
    render(
      <CostDisplay
        cost={{ metal: 100, crystal: 200, deuterium: 300 }}
        available={{
          metal: 150,
          crystal: 150,
          deuterium: 300,
          energyProduction: 0,
          energyConsumption: 0,
        }}
      />,
    );

    expect(screen.getByText('M 100')).not.toHaveClass('insufficient');
    expect(screen.getByText('C 200')).toHaveClass('insufficient');
    expect(screen.getByText('D 300')).not.toHaveClass('insufficient');
  });
});
