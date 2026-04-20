/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from 'react';
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
  startedAt?: number | null;
  totalDurationMs?: number | null;
  onCancel?: () => void;
  action?: React.ReactNode;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function useQueueProgress(
  startedAt: number | null | undefined,
  completesAt: number | null,
  totalDurationMs: number | null | undefined,
): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (
      startedAt === null ||
      startedAt === undefined ||
      completesAt === null ||
      totalDurationMs === null ||
      totalDurationMs === undefined ||
      totalDurationMs <= 0
    ) {
      return;
    }

    let frameId = 0;

    const updateNow = () => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow >= completesAt) {
        return;
      }
      frameId = requestAnimationFrame(updateNow);
    };

    frameId = requestAnimationFrame(updateNow);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [completesAt, startedAt, totalDurationMs]);

  return useMemo(() => {
    if (
      startedAt === null ||
      startedAt === undefined ||
      completesAt === null ||
      totalDurationMs === null ||
      totalDurationMs === undefined ||
      totalDurationMs <= 0
    ) {
      return null;
    }

    if (now >= completesAt) {
      return 1;
    }

    if (now <= startedAt) {
      return 0;
    }

    return clamp01((now - startedAt) / totalDurationMs);
  }, [completesAt, now, startedAt, totalDurationMs]);
}

export function QueueRow({
  label,
  subtitle,
  completesAt,
  duration,
  startedAt,
  totalDurationMs,
  onCancel,
  action,
}: QueueRowProps) {
  const countdown = useCountdown(completesAt);
  const progress = useQueueProgress(startedAt, completesAt, totalDurationMs);

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
        <button type="button" className="queue-cancel-button" onClick={onCancel}>
          Cancel
        </button>
      )}
      {progress !== null && (
        <div className="queue-progress" aria-hidden="true">
          <span
            className="queue-progress__fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
