import { useEffect, useState } from 'react';
import { formatCountdown } from '../utils/time.ts';

export function useCountdown(completesAt: number | null): string {
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    if (completesAt === null) {
      setCountdown('');
      return;
    }

    let rafId = 0;

    const update = (): void => {
      const remainingMs = completesAt - Date.now();
      setCountdown(formatCountdown(remainingMs));

      if (remainingMs > 0) {
        rafId = requestAnimationFrame(update);
      }
    };

    update();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [completesAt]);

  return countdown;
}
