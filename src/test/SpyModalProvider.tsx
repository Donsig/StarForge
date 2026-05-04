/* eslint-disable react-refresh/only-export-components -- test helper intentionally exports a provider component and spy factory together. */
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { ModalProvider } from '../context/ModalContext';
import type { ModalContextValue, SelectedCard } from '../context/ModalContext';

export function createSpyModalValue(selectedCard: SelectedCard | null = null): {
  value: ModalContextValue;
  spies: { open: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; restoreFocus: ReturnType<typeof vi.fn> };
} {
  const open = vi.fn();
  const close = vi.fn();
  const restoreFocus = vi.fn();
  const value: ModalContextValue = { selectedCard, open, close, restoreFocus };
  return { value, spies: { open, close, restoreFocus } };
}

export function SpyModalProvider({
  selectedCard = null,
  children,
}: {
  selectedCard?: SelectedCard | null;
  children: ReactNode;
}) {
  const { value } = createSpyModalValue(selectedCard);
  return <ModalProvider value={value}>{children}</ModalProvider>;
}
