import type { KeyboardEvent } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  color?: string;
  ariaLabel: string;
}

export function Toggle({
  checked,
  onChange,
  color = '#4d8fff',
  ariaLabel,
}: ToggleProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    onChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      data-color={color}
      className={`toggle${checked ? ' toggle--checked' : ''}`}
      style={{ ['--toggle-color' as string]: color }}
      onClick={() => onChange(!checked)}
      onKeyDown={handleKeyDown}
    >
      <span className="toggle__thumb" />
    </button>
  );
}
