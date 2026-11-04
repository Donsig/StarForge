/// <reference types="vitest/globals" />

import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { HoverPortal } from '../HoverPortal.tsx';

function makeRect(partial: Partial<DOMRect>): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...partial,
  } as DOMRect;
}

const DEFAULT_ANCHOR = { left: 20, right: 120, top: 100, bottom: 130, width: 100, height: 30 };
const DEFAULT_PANEL = { left: 0, right: 400, top: 136, bottom: 336, width: 400, height: 200 };

function installRectMocks(anchor: Partial<DOMRect>, panel: Partial<DOMRect>) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.dataset.testid === 'anchor') return makeRect(anchor);
      if (this.classList.contains('test-panel')) return makeRect(panel);
      return makeRect({});
    },
  );
}

function getPanel(): HTMLElement {
  const panel = document.body.querySelector('.test-panel');
  if (!panel) throw new Error('panel portal element not found');
  return panel as HTMLElement;
}

function Harness({ open }: { open: boolean }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div data-testid="anchor" ref={anchorRef} />
      <HoverPortal anchorRef={anchorRef} open={open} align="below-right" className="test-panel">
        <p>panel content</p>
      </HoverPortal>
    </>
  );
}

describe('HoverPortal', () => {
  beforeEach(() => {
    installRectMocks(DEFAULT_ANCHOR, DEFAULT_PANEL);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<Harness open={false} />);
    expect(screen.queryByText('panel content')).not.toBeInTheDocument();
  });

  it('clamps a wide right-aligned panel so it does not overflow the left edge', () => {
    render(<Harness open />);
    // panelLeft = anchorRight(120) - panelWidth(400) = -280 < VIEWPORT_PADDING(8)
    // → clamped right edge = 8 + 400 = 408 → right offset = innerWidth(1024) - 408 = 616
    expect(getPanel()).toHaveStyle({ right: '616px' });
  });

  it('keeps default right alignment when the panel fits on screen', () => {
    installRectMocks(
      { left: 600, right: 700, top: 100, bottom: 130, width: 100, height: 30 },
      { left: 300, right: 700, top: 136, bottom: 336, width: 400, height: 200 },
    );
    render(<Harness open />);
    // panelLeft(300) >= VIEWPORT_PADDING(8) → right edge stays at anchor right(700)
    // → right offset = innerWidth(1024) - 700 = 324
    expect(getPanel()).toHaveStyle({ right: '324px' });
  });
});
