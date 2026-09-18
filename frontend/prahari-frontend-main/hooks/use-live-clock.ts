'use client';

// A real wall-clock tick for the command-center hero and header — genuinely
// current time, re-rendered once a minute (no need for per-second churn on a
// display that only shows HH:MM).

import { useEffect, useState } from 'react';

export function useLiveClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return now;
}
