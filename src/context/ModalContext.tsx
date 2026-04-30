import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CardType } from '../utils/cardDetails';

export interface SelectedCard {
  type: CardType;
  id: string;
}

export interface ModalContextValue {
  selectedCard: SelectedCard | null;
  open: (type: CardType, id: string) => void;
  close: () => void;
  restoreFocus: () => void;
}

interface ModalProviderProps {
  children: ReactNode;
  value?: ModalContextValue;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children, value }: ModalProviderProps) {
  if (value !== undefined) {
    return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
  }

  return <InternalModalProvider>{children}</InternalModalProvider>;
}

function InternalModalProvider({ children }: { children: ReactNode }) {
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const originRef = useRef<HTMLElement | null>(null);

  const open = useCallback((type: CardType, id: string) => {
    if (originRef.current === null && typeof document !== 'undefined') {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        originRef.current = activeElement;
      }
    }

    setSelectedCard({ type, id });
  }, []);

  const close = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const restoreFocus = useCallback(() => {
    const origin = originRef.current;

    if (origin !== null && origin.isConnected && typeof origin.focus === 'function') {
      origin.focus();
    }

    originRef.current = null;
  }, []);

  const internalValue = useMemo<ModalContextValue>(
    () => ({
      selectedCard,
      open,
      close,
      restoreFocus,
    }),
    [selectedCard, open, close, restoreFocus],
  );

  return <ModalContext.Provider value={internalValue}>{children}</ModalContext.Provider>;
}

export function useModal(): ModalContextValue {
  const context = useContext(ModalContext);

  if (context === null) {
    throw new Error('useModal must be used within a ModalProvider');
  }

  return context;
}
