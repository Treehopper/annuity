import type { Clock } from '@alp/core';

/** Device clock and time zone. The local calendar date is "today" (§5.10). */
export const deviceClock: Clock = {
  today() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  now() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  },
};
