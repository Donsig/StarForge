import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

interface Pos {
  top: number;
  ready: boolean;
}

const VIEWPORT_PADDING = 8;
const ANCHOR_GAP = 6;

interface HoverPortalProps {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  children: ReactNode;
  align?: 'below-right' | 'below-left' | 'below-center';
  className?: string;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
}

export function HoverPortal({
  anchorRef,
  open,
  children,
  align = 'below-right',
  className,
  onMouseEnter,
  onMouseLeave,
}: HoverPortalProps) {
  const [pos, setPos] = useState<Pos | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }

    const updatePos = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) {
        setPos(null);
        return;
      }
      // Start hidden for measurement pass
      setPos({ top: rect.bottom + ANCHOR_GAP, ready: false });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);

    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, anchorRef, align]);

  // After measuring pass: flip above anchor if panel would overflow viewport bottom
  useLayoutEffect(() => {
    if (!pos || pos.ready || !panelRef.current || !anchorRef.current) return;
    const panelHeight = panelRef.current.getBoundingClientRect().height;
    const anchorRect = anchorRef.current.getBoundingClientRect();
    const belowTop = anchorRect.bottom + ANCHOR_GAP;
    const aboveTop = anchorRect.top - panelHeight - ANCHOR_GAP;
    const belowOverflows = belowTop + panelHeight > window.innerHeight - VIEWPORT_PADDING;
    const canFitAbove = aboveTop >= VIEWPORT_PADDING;

    let top = belowTop;
    if (belowOverflows && canFitAbove) {
      top = aboveTop;
    }
    setPos({ top: Math.max(VIEWPORT_PADDING, top), ready: true });
  }, [pos, anchorRef]);

  if (!open || !pos || !anchorRef.current) {
    return null;
  }

  const rect = anchorRef.current.getBoundingClientRect();
  const style: CSSProperties = {
    position: 'fixed',
    top: pos.top,
    zIndex: 9999,
    visibility: pos.ready ? 'visible' : 'hidden',
  };

  if (align === 'below-right') {
    style.right = window.innerWidth - rect.right;
  } else if (align === 'below-left') {
    style.left = rect.left;
  } else {
    style.left = rect.left + rect.width / 2;
    style.transform = 'translateX(-50%)';
  }

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  );
}
