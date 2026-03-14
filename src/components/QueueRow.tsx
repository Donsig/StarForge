/* eslint-disable react-refresh/only-export-components */
import { useCountdown } from '../hooks/useCountdown';
import type { QueueItem } from '../models/types.ts';
import { formatDuration } from '../utils/time.ts';

export function getQueuedItemDuration(item: QueueItem): string {
  const perUnitMs = item.completesAt - item.startedAt;
  if (item.type === 'ship' || item.type === 'defence') {
    return formatDuration((perUnitMs * (item.quantity ?? 1)) / 1000);
  }
  return formatDuration(perUnitMs / 1000);
}

interface QueueRowProps {
  label: string;
  subtitle: string;
  completesAt: number | null;
  duration?: string;
  onCancel?: () => void;
  action?: React.ReactNode;
}

export function QueueRow({ label, subtitle, completesAt, duration, onCancel, action }: QueueRowProps) {
  const countdown = useCountdown(completesAt);

  return (
    <div className="queue-item">
      <div className="queue-main">
        <div className="queue-label">{label}</div>
        <div className="queue-subtitle">{subtitle}</div>
      </div>
      {(countdown || duration) && (
        <div className="queue-time number">{countdown || duration}</div>
      )}
      {action}
      {onCancel && (
        <button type="button" className="btn btn-danger" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
