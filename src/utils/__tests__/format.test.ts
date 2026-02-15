/// <reference types="vitest/globals" />

import { formatCompact, formatNumber, formatRate } from '../format.ts';

describe('format utils', () => {
  it('formatNumber formats integer values with separators', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formatCompact formats values at key thresholds', () => {
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(10000)).toBe('10.0K');
    expect(formatCompact(1500000)).toBe('1.5M');
    expect(formatCompact(2000000000)).toBe('2.0B');
  });

  it('formatRate formats positive and negative per-hour values', () => {
    expect(formatRate(1234)).toBe('+1,234/h');
    expect(formatRate(-1500000)).toBe('-1.5M/h');
  });
});
