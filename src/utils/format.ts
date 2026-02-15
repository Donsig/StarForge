/** Format a number with locale-aware separators (e.g. 12,345) */
export function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

/** Format a number compactly (e.g. 1.2M, 45.3K) */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 10_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString('en-US');
}

/** Format a per-hour rate as a signed string (e.g. "+1,234/h") */
export function formatRate(perHour: number): string {
  const sign = perHour >= 0 ? '+' : '';
  return `${sign}${formatCompact(perHour)}/h`;
}
