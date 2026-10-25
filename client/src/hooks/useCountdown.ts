import { useEffect, useState } from 'react';
import { useGame } from '../store/game';
export function useCountdown(deadline: number | null) {
  const offset = useGame((s) => s.clockOffset);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - now - offset) / 1000)) : 0;
}
