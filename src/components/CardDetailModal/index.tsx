import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BUILDINGS } from '../../data/buildings';
import { DEFENCES } from '../../data/defences';
import { RESEARCH } from '../../data/research';
import { SHIPS } from '../../data/ships';
import { useModal } from '../../context/ModalContext';
import { TYPE_ACCENTS, type CardType } from '../../utils/cardDetails';
import { LeftColumn } from './LeftColumn';
import { RightColumn } from './RightColumn';

type DisplayedCard = {
  type: CardType;
  id: string;
};

type ModalPhase = 'open' | 'closing' | 'closed';
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function cardsDiffer(a: DisplayedCard | null, b: DisplayedCard): boolean {
  return a === null || a.type !== b.type || a.id !== b.id;
}
function hasCardDefinition(card: DisplayedCard): boolean {
  switch (card.type) {
    case 'building':
      return Object.prototype.hasOwnProperty.call(BUILDINGS, card.id);
    case 'research':
      return Object.prototype.hasOwnProperty.call(RESEARCH, card.id);
    case 'ship':
      return Object.prototype.hasOwnProperty.call(SHIPS, card.id);
    case 'defence':
      return Object.prototype.hasOwnProperty.call(DEFENCES, card.id);
  }
}

export default function CardDetailModal() {
  const { selectedCard, close, restoreFocus } = useModal();
  const [displayedCard, setDisplayedCard] = useState<DisplayedCard | null>(null);
  const [phase, setPhase] = useState<ModalPhase>('closed');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCard !== null && cardsDiffer(displayedCard, selectedCard)) {
      setDisplayedCard(selectedCard);
      setPhase('open');
      return;
    }

    if (selectedCard === null && displayedCard !== null) {
      setPhase('closing');
    }
  }, [selectedCard, displayedCard]);

  useEffect(() => {
    if (phase === 'open') {
      containerRef.current?.focus();
    }
  }, [phase]);

  useEffect(() => {
    if (displayedCard === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, displayedCard]);

  useEffect(() => {
    if (displayedCard === null) {
      return;
    }

    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (first === undefined || last === undefined) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [displayedCard]);

  if (displayedCard === null) {
    return null;
  }

  const accent = TYPE_ACCENTS[displayedCard.type];
  const titleId = `card-detail-title-${displayedCard.id}`;
  const hasDefinition = hasCardDefinition(displayedCard);

  const onAnimationEnd = () => {
    if (phase === 'closing') {
      restoreFocus();
      setDisplayedCard(null);
      setPhase('closed');
    }
  };

  return createPortal(
    <div
      className="card-detail-modal__backdrop"
      onClick={() => close()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,4,14,0.55)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="card-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={containerRef}
        onClick={(event) => event.stopPropagation()}
        onAnimationEnd={onAnimationEnd}
        data-state={phase}
        style={{
          width: 700,
          maxWidth: '96vw',
          maxHeight: '92vh',
          background: 'rgba(7,10,22,0.97)',
          border: `1px solid ${accent.bd}`,
          borderRadius: 12,
          boxShadow: `0 0 70px rgba(0,0,0,0.75), 0 0 32px ${accent.glow}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="card-detail-modal__top-bar">
          <span style={{ color: accent.c }}>{displayedCard.type.toUpperCase()}</span>
          <span>INTEL FILE · CLASSIFIED</span>
          <button type="button" aria-label="Close" onClick={() => close()}>
            ×
          </button>
        </div>

        {hasDefinition ? (
          <div
            className="card-detail-modal__body"
            style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              style={{
                flex: '0 0 250px',
                borderRight: '1px solid rgba(40,60,120,0.22)',
              }}
            >
              <LeftColumn card={displayedCard} />
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <RightColumn card={displayedCard} />
            </div>
          </div>
        ) : (
          <div>
            <h2 id={titleId}>Unknown item</h2>
            {`Unavailable item — id: ${displayedCard.id}`}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
