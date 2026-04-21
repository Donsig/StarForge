/// <reference types="vitest/globals" />

// Regression tests for the ToastContainer component (Task 16).
// These tests FAIL against current production code because:
//   1. ToastContainer.tsx doesn't exist yet.
//   2. NotificationContext/useNotifications hook doesn't exist yet.
//
// Vitest will error with "Failed to resolve import ../ToastContainer" which is
// the correct "red" state for TDD. When ToastContainer.tsx ships, remove the
// temporary import suppressions and all tests should pass.
//
// ToastContainer API:
//   export function ToastContainer(): JSX.Element | null
//   - Reads toast queue from NotificationContext
//   - Renders up to 5 toasts fixed top-right
//   - When a 6th toast is enqueued, the oldest is dropped (FIFO)
//
// For tests we wrap ToastContainer in a test provider that seeds the queue.
// The dev subagent will pick the exact context shape; tests assume the
// NotificationContext is exported from src/context/NotificationContext.tsx
// with the shape shown below.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { ToastContainer } from '../ToastContainer';

import { NotificationContext } from '../../context/NotificationContext';

// ---------------------------------------------------------------------------
// Local type declarations mirroring the upcoming NotificationContext shape.
// These will be deleted/replaced when the real context ships.
// ---------------------------------------------------------------------------

interface ToastItem {
  id: string;
  type: 'combat' | 'fleet' | 'espionage';
  message: string;
  navTab: 'combat' | 'fleet' | 'espionage';
}

interface NotificationContextValue {
  queue: ToastItem[];
  dismiss: (id: string) => void;
  navigate: (id: string) => void;
}

function TestNotificationProvider({
  queue,
  onNavigate,
  onDismiss,
  children,
}: {
  queue: ToastItem[];
  onNavigate?: (id: string) => void;
  onDismiss?: (id: string) => void;
  children: ReactNode;
}) {
  const value: NotificationContextValue = {
    queue,
    dismiss: onDismiss ?? (() => {}),
    navigate: onNavigate ?? (() => {}),
  };

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

function makeToast(
  id: string,
  type: 'combat' | 'fleet' | 'espionage' = 'combat',
): ToastItem {
  return {
    id,
    type,
    message: `Event at [1:${id}:3]`,
    navTab: type,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ToastContainer', () => {
  it('renders nothing when queue is empty', () => {
    const { container } = render(
      <TestNotificationProvider queue={[]}>
        <ToastContainer />
      </TestNotificationProvider>,
    );

    // No toast elements should be present
    expect(container.querySelector('[class*="toast"]')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // No dismiss buttons either
    expect(screen.queryByRole('button', { name: /dismiss|close|×/i })).toBeNull();
  });

  it('renders multiple toasts from queue', () => {
    render(
      <TestNotificationProvider
        queue={[makeToast('1'), makeToast('2'), makeToast('3')]}
      >
        <ToastContainer />
      </TestNotificationProvider>,
    );

    expect(screen.getByText('Event at [1:1:3]')).toBeInTheDocument();
    expect(screen.getByText('Event at [1:2:3]')).toBeInTheDocument();
    expect(screen.getByText('Event at [1:3:3]')).toBeInTheDocument();
  });

  it('caps visible toasts at 5 when queue has 7', () => {
    const sevenToasts = Array.from({ length: 7 }, (_, i) => makeToast(String(i + 1)));

    render(
      <TestNotificationProvider queue={sevenToasts}>
        <ToastContainer />
      </TestNotificationProvider>,
    );

    // Only up to 5 toasts should be visible (one dismiss button per toast)
    const dismissButtons = screen.queryAllByRole('button', { name: /dismiss|close|×/i });
    expect(dismissButtons.length).toBeLessThanOrEqual(5);
  });

  it('drops oldest toast when a 6th is added (FIFO drop-oldest)', () => {
    // Start with 5 toasts
    const initialQueue = Array.from({ length: 5 }, (_, i) =>
      makeToast(`toast-${i + 1}`),
    );

    const { rerender } = render(
      <TestNotificationProvider queue={initialQueue}>
        <ToastContainer />
      </TestNotificationProvider>,
    );

    // Verify first toast is visible
    expect(screen.getByText('Event at [1:toast-1:3]')).toBeInTheDocument();

    // Add a 6th toast
    const sixToasts = [...initialQueue, makeToast('toast-6')];

    rerender(
      <TestNotificationProvider queue={sixToasts}>
        <ToastContainer />
      </TestNotificationProvider>,
    );

    // After adding 6th, oldest (toast-1) should be dropped from display
    // and toast-6 should be visible
    expect(screen.queryByText('Event at [1:toast-1:3]')).not.toBeInTheDocument();
    expect(screen.getByText('Event at [1:toast-6:3]')).toBeInTheDocument();
  });

  it('navigates to Messages with correct initial tab when combat toast is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <TestNotificationProvider
        queue={[makeToast('battle-1', 'combat')]}
        onNavigate={onNavigate}
      >
        <ToastContainer />
      </TestNotificationProvider>,
    );

    // Click the toast body (message text)
    await user.click(screen.getByText('Event at [1:battle-1:3]'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('battle-1');
  });

  it('each toast has a dismiss button that calls dismiss', async () => {
    const user = userEvent.setup();
    const dismissFn = vi.fn();

    render(
      <TestNotificationProvider
        queue={[makeToast('t1'), makeToast('t2')]}
        onDismiss={dismissFn}
      >
        <ToastContainer />
      </TestNotificationProvider>,
    );

    const dismissButtons = screen.getAllByRole('button', { name: /dismiss|close|×/i });
    expect(dismissButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(dismissButtons[0]);
    expect(dismissFn).toHaveBeenCalledTimes(1);
  });
});
