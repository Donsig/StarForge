import { renderHook, act } from '@testing-library/react';
import { useNow } from '../useNow.ts';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current timestamp on mount', () => {
    const before = Date.now();
    const { result } = renderHook(() => useNow(1000));
    expect(result.current).toBeGreaterThanOrEqual(before);
  });

  it('updates after the interval elapses', () => {
    const { result } = renderHook(() => useNow(1000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBeGreaterThan(initial);
  });

  it('clears interval on unmount', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => useNow(1000));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
