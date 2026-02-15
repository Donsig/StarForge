/// <reference types="vitest/globals" />

import { formatCountdown, formatDuration } from '../time.ts';

describe('time utils', () => {
  it('formatCountdown renders HH:MM:SS for key millisecond values', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(61000)).toBe('00:01:01');
    expect(formatCountdown(3661000)).toBe('01:01:01');
  });

  it('formatDuration renders concise duration strings', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(65)).toBe('1m 5s');
    expect(formatDuration(3665)).toBe('1h 1m 5s');
  });
});
