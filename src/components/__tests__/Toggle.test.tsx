/// <reference types="vitest/globals" />

// Regression tests for the Toggle component (Task 16).
// These tests FAIL against current production code because Toggle.tsx doesn't
// exist yet — vitest will error with "Failed to resolve import ../Toggle"
// which is the correct "red" state for TDD.
//
// When Toggle.tsx ships, remove the temporary import suppression and all tests should pass.
//
// Toggle API:
//   interface ToggleProps {
//     checked: boolean;
//     onChange: (next: boolean) => void;
//     color?: string;
//     ariaLabel: string;
//   }
// 40×22px pill, role="switch", aria-checked reflects `checked`.
// Keyboard accessible: Space and Enter toggle the value.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Toggle } from '../Toggle';

describe('Toggle component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with checked state (aria-checked=true)', () => {
    render(
      <Toggle
        checked={true}
        onChange={() => {}}
        ariaLabel="Enable feature"
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Enable feature' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('renders with unchecked state (aria-checked=false)', () => {
    render(
      <Toggle
        checked={false}
        onChange={() => {}}
        ariaLabel="Enable feature"
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Enable feature' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with inverted value when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Toggle checked={false} onChange={onChange} ariaLabel="Enable feature" />,
    );

    await user.click(screen.getByRole('switch', { name: 'Enable feature' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with inverted value when checked and clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Toggle checked={true} onChange={onChange} ariaLabel="Enable feature" />,
    );

    await user.click(screen.getByRole('switch', { name: 'Enable feature' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('calls onChange when Space key pressed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Toggle checked={false} onChange={onChange} ariaLabel="Enable feature" />,
    );

    const toggle = screen.getByRole('switch', { name: 'Enable feature' });
    toggle.focus();
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange when Enter key pressed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Toggle checked={false} onChange={onChange} ariaLabel="Enable feature" />,
    );

    const toggle = screen.getByRole('switch', { name: 'Enable feature' });
    toggle.focus();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('uses provided aria-label', () => {
    render(
      <Toggle
        checked={false}
        onChange={() => {}}
        ariaLabel="God Mode"
      />,
    );

    expect(
      screen.getByRole('switch', { name: 'God Mode' }),
    ).toBeInTheDocument();
  });

  it('applies custom color when provided via data attribute or inline style', () => {
    const { container } = render(
      <Toggle
        checked={true}
        onChange={() => {}}
        ariaLabel="Colored toggle"
        color="#f87171"
      />,
    );

    // The Toggle must persist the color somewhere in the DOM. Check either a
    // data-color attribute or inline style containing the hex value.
    const el = container.firstElementChild as HTMLElement;
    const hasColor =
      el?.getAttribute('data-color') === '#f87171' ||
      (el?.style?.getPropertyValue('--toggle-color') === '#f87171') ||
      JSON.stringify(el?.outerHTML).includes('f87171');

    expect(hasColor).toBe(true);
  });
});
