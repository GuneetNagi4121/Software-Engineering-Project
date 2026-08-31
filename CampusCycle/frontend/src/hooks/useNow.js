import { useEffect, useState } from 'react';

/**
 * Re-renders on an interval so callers can compute a live-updating elapsed
 * value from a fixed start timestamp. Returns the current epoch ms.
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date().getTime());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().getTime()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
