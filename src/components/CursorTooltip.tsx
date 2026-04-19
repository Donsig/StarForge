import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface CursorTooltipProps {
  x: number;
  y: number;
  visible: boolean;
  children: ReactNode;
  offset?: { x: number; y: number };
}

const DEFAULT_OFFSET = { x: 16, y: 16 };

function clampPosition(
  cursorX: number,
  cursorY: number,
  offset: { x: number; y: number },
  width: number,
  height: number,
) {
  let left = cursorX + offset.x;
  let top = cursorY + offset.y;

  if (left + width > window.innerWidth) {
    left = cursorX - width - offset.x;
  }

  if (top + height > window.innerHeight) {
    top = cursorY - height - offset.y;
  }

  left = Math.max(0, Math.min(left, window.innerWidth - width));
  top = Math.max(0, Math.min(top, window.innerHeight - height));

  return { left, top };
}

export function CursorTooltip({
  x,
  y,
  visible,
  children,
  offset = DEFAULT_OFFSET,
}: CursorTooltipProps) {
  const offsetX = offset.x;
  const offsetY = offset.y;
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() =>
    clampPosition(x, y, { x: offsetX, y: offsetY }, 0, 0),
  );

  useLayoutEffect(() => {
    if (!visible || tooltipRef.current === null) {
      return;
    }

    const rect = tooltipRef.current.getBoundingClientRect();
    const nextPosition = clampPosition(
      x,
      y,
      { x: offsetX, y: offsetY },
      rect.width,
      rect.height,
    );

    setPosition((currentPosition) => {
      if (
        currentPosition.left === nextPosition.left &&
        currentPosition.top === nextPosition.top
      ) {
        return currentPosition;
      }

      return nextPosition;
    });
  }, [children, offsetX, offsetY, visible, x, y]);

  if (!visible) {
    return null;
  }

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        pointerEvents: 'none',
        zIndex: 1000,
        willChange: 'transform',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
