import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ModalProvider,
  useModal,
  type ModalContextValue,
} from '../ModalContext';

function Probe({ onValue }: { onValue: (value: ModalContextValue) => void }) {
  onValue(useModal());
  return null;
}

describe('ModalContext', () => {
  it('opens and closes the selected card', () => {
    let modal: ModalContextValue | undefined;

    render(
      <ModalProvider>
        <Probe onValue={(value) => { modal = value; }} />
      </ModalProvider>,
    );

    expect(getModal().selectedCard).toBeNull();

    act(() => {
      getModal().open('building', 'metalMine');
    });

    expect(getModal().selectedCard).toEqual({ type: 'building', id: 'metalMine' });

    act(() => {
      getModal().close();
    });

    expect(getModal().selectedCard).toBeNull();

    function getModal() {
      if (modal === undefined) {
        throw new Error('Modal context was not captured');
      }

      return modal;
    }
  });

  it('preserves originating focus across prereq navigation', () => {
    let modal: ModalContextValue | undefined;

    const { getByRole } = render(
      <>
        <button type="button">Original opener</button>
        <ModalProvider>
          <button type="button">Inside modal tree</button>
          <Probe onValue={(value) => { modal = value; }} />
        </ModalProvider>
      </>,
    );

    const originalOpener = getByRole('button', { name: 'Original opener' });
    const insideButton = getByRole('button', { name: 'Inside modal tree' });

    originalOpener.focus();
    expect(document.activeElement).toBe(originalOpener);

    act(() => {
      getModal().open('building', 'metalMine');
    });

    insideButton.focus();
    expect(document.activeElement).toBe(insideButton);

    act(() => {
      getModal().open('research', 'energyTechnology');
    });

    act(() => {
      getModal().close();
      getModal().restoreFocus();
    });

    expect(document.activeElement).toBe(originalOpener);

    function getModal() {
      if (modal === undefined) {
        throw new Error('Modal context was not captured');
      }

      return modal;
    }
  });

  it('restoreFocus returns focus once and clears the origin', () => {
    let modal: ModalContextValue | undefined;

    const { getByRole } = render(
      <>
        <button type="button">Original opener</button>
        <button type="button">Fallback target</button>
        <ModalProvider>
          <Probe onValue={(value) => { modal = value; }} />
        </ModalProvider>
      </>,
    );

    const originalOpener = getByRole('button', { name: 'Original opener' });
    const fallbackTarget = getByRole('button', { name: 'Fallback target' });

    originalOpener.focus();

    act(() => {
      getModal().open('building', 'metalMine');
    });

    fallbackTarget.focus();

    act(() => {
      getModal().restoreFocus();
    });

    expect(document.activeElement).toBe(originalOpener);

    fallbackTarget.focus();

    act(() => {
      getModal().restoreFocus();
    });

    expect(document.activeElement).toBe(fallbackTarget);

    function getModal() {
      if (modal === undefined) {
        throw new Error('Modal context was not captured');
      }

      return modal;
    }
  });

  it('uses the provided value prop instead of internal state', () => {
    let modal: ModalContextValue | undefined;
    const value: ModalContextValue = {
      selectedCard: { type: 'ship', id: 'lightFighter' },
      open: vi.fn(),
      close: vi.fn(),
      restoreFocus: vi.fn(),
    };

    render(
      <ModalProvider value={value}>
        <Probe onValue={(contextValue) => { modal = contextValue; }} />
      </ModalProvider>,
    );

    expect(getModal()).toBe(value);

    act(() => {
      getModal().open('building', 'metalMine');
      getModal().close();
      getModal().restoreFocus();
    });

    expect(value.open).toHaveBeenCalledWith('building', 'metalMine');
    expect(value.close).toHaveBeenCalledTimes(1);
    expect(value.restoreFocus).toHaveBeenCalledTimes(1);
    expect(getModal().selectedCard).toEqual({ type: 'ship', id: 'lightFighter' });

    function getModal() {
      if (modal === undefined) {
        throw new Error('Modal context was not captured');
      }

      return modal;
    }
  });
});
