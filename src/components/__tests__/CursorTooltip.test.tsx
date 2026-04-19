/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react';
import { CursorTooltip } from '../CursorTooltip.tsx';

describe('CursorTooltip', () => {
  it('renders children when visible is true', () => {
    render(
      <CursorTooltip visible x={100} y={200}>
        Mission details
      </CursorTooltip>,
    );

    expect(screen.getByText('Mission details')).toBeInTheDocument();
  });

  it('renders nothing when visible is false', () => {
    render(
      <CursorTooltip visible={false} x={100} y={200}>
        Mission details
      </CursorTooltip>,
    );

    expect(screen.queryByText('Mission details')).not.toBeInTheDocument();
  });

  it('renders portal output into document.body instead of the parent container', () => {
    const { container } = render(
      <div data-testid="parent">
        <CursorTooltip visible x={100} y={200}>
          Mission details
        </CursorTooltip>
      </div>,
    );

    const tooltipText = screen.getByText('Mission details');
    expect(container).not.toContainElement(tooltipText);
    expect(document.body).toContainElement(tooltipText);
  });

  it('applies fixed positioning with left and top offsets', () => {
    render(
      <CursorTooltip visible x={100} y={200}>
        Mission details
      </CursorTooltip>,
    );

    expect(screen.getByText('Mission details')).toHaveStyle({
      position: 'fixed',
      left: '116px',
      top: '216px',
    });
  });
});
