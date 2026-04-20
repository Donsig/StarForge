/// <reference types="vitest/globals" />

// Regression tests for the Toast component (Task 16).
// These tests FAIL against current production code because Toast.tsx doesn't
// exist yet — vitest will error with "Failed to resolve import ../Toast"
// which is the correct "red" state for TDD.
//
// When Toast.tsx ships, remove the @ts-expect-error and all tests should pass.
//
// Toast API:
//   interface ToastProps {
//     id: string;
//     type: 'combat' | 'fleet' | 'espionage';
//     message: string;
//     onDismiss: () => void;
//     onNavigate: () => void;
//   }
//
// Behaviour:
//   - Auto-dismisses after 5000ms via onDismiss()
//   - Clicking the main body calls onNavigate() (not onDismiss)
//   - Clicking the X button calls onDismiss() (not onNavigate)
//   - Timer is cleaned up on unmount

import { fireEvent, render, screen } from '@testing-library/react';

// @ts-expect-error — Toast.tsx created by dev subagent (Task 16); doesn't exist yet.
// Vitest will fail with module-not-found at runtime — that is the intended "red" state.
import { Toast } from '../Toast';

describe('Toast component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders message content', () => {
    render(
      <Toast
        id="t1"
        type="combat"
        message="Battle at [1:2:3]"
        onDismiss={() => {}}
        onNavigate={() => {}}
      />,
    );

    expect(screen.getByText('Battle at [1:2:3]')).toBeInTheDocument();
  });

  it('renders dismiss button with accessible label', () => {
    render(
      <Toast
        id="t1"
        type="combat"
        message="Battle at [1:2:3]"
        onDismiss={() => {}}
        onNavigate={() => {}}
      />,
    );

    // Dismiss button should be accessible by its label (e.g., "Dismiss", "Close", or "×")
    const dismissBtn = screen.getByRole('button', { name: /dismiss|close|×/i });
    expect(dismissBtn).toBeInTheDocument();
  });

  it('calls onDismiss when X button is clicked', () => {
    const onDismiss = vi.fn();
    const onNavigate = vi.fn();

    render(
      <Toast
        id="t1"
        type="combat"
        message="Battle at [1:2:3]"
        onDismiss={onDismiss}
        onNavigate={onNavigate}
      />,
    );

    // Use fireEvent (synchronous) instead of userEvent.click to avoid
    // userEvent's internal delay machinery hanging under vi.useFakeTimers.
    fireEvent.click(screen.getByRole('button', { name: /dismiss|close|×/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('calls onNavigate when toast body is clicked (not the X)', () => {
    const onDismiss = vi.fn();
    const onNavigate = vi.fn();

    render(
      <Toast
        id="t1"
        type="combat"
        message="Battle at [1:2:3]"
        onDismiss={onDismiss}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByText('Battle at [1:2:3]'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('auto-dismisses after 5000ms', () => {
    const onDismiss = vi.fn();

    render(
      <Toast
        id="t1"
        type="fleet"
        message="Fleet returned"
        onDismiss={onDismiss}
        onNavigate={() => {}}
      />,
    );

    // Not dismissed yet at 4999ms
    vi.advanceTimersByTime(4999);
    expect(onDismiss).not.toHaveBeenCalled();

    // Dismissed at exactly 5000ms
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('applies type-specific className for combat', () => {
    const { container } = render(
      <Toast
        id="t1"
        type="combat"
        message="msg"
        onDismiss={() => {}}
        onNavigate={() => {}}
      />,
    );

    const el = container.firstElementChild;
    expect(el?.className).toMatch(/combat/);
  });

  it('applies type-specific className for fleet', () => {
    const { container } = render(
      <Toast
        id="t2"
        type="fleet"
        message="msg"
        onDismiss={() => {}}
        onNavigate={() => {}}
      />,
    );

    const el = container.firstElementChild;
    expect(el?.className).toMatch(/fleet/);
  });

  it('applies type-specific className for espionage', () => {
    const { container } = render(
      <Toast
        id="t3"
        type="espionage"
        message="msg"
        onDismiss={() => {}}
        onNavigate={() => {}}
      />,
    );

    const el = container.firstElementChild;
    expect(el?.className).toMatch(/espionage/);
  });

  it('cleans up timer on unmount — onDismiss NOT called after unmount', () => {
    const onDismiss = vi.fn();

    const { unmount } = render(
      <Toast
        id="t1"
        type="combat"
        message="Battle at [1:2:3]"
        onDismiss={onDismiss}
        onNavigate={() => {}}
      />,
    );

    // Unmount before the 5000ms timer fires
    vi.advanceTimersByTime(2000);
    unmount();

    // Advance past the timer — should NOT call onDismiss since cleanup ran
    vi.advanceTimersByTime(5000);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
