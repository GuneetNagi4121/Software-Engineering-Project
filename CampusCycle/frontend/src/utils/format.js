/** Join truthy class names. */
export function cn(...args) {
  return args.filter(Boolean).join(' ');
}

/** e.g. "10:32 AM" */
export function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** e.g. "31 Aug 2026" */
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

/** e.g. "31 Aug, 10:32 AM" */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })}, ${formatTime(iso)}`;
}

/**
 * Human-readable duration between two ISO timestamps (defaults `to` to now).
 * e.g. "45m", "1h 05m", "2d 3h".
 */
export function formatDuration(fromIso, toIso) {
  if (!fromIso) return '—';
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  let seconds = Math.max(0, Math.floor((to - from) / 1000));

  const days = Math.floor(seconds / 86400);
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
}

/**
 * Human-readable duration from a number of seconds, as computed by the
 * backend (rentals carry `duration_seconds`). Returns "—" when the backend
 * could not determine a duration, rather than inventing one.
 * e.g. "45m", "1h 05m", "2d 3h".
 */
export function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return '—';
  let total = Math.max(0, Math.floor(Number(seconds)));

  const days = Math.floor(total / 86400);
  total -= days * 86400;
  const hours = Math.floor(total / 3600);
  total -= hours * 3600;
  const minutes = Math.floor(total / 60);
  const secs = total - minutes * 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${secs}s`;
}

/** e.g. "41.5 min" — for average durations reported in minutes. */
export function formatMinutes(mins) {
  if (mins === null || mins === undefined || Number.isNaN(Number(mins))) return '—';
  return `${Number(mins).toFixed(1)} min`;
}

/** Today as YYYY-MM-DD in the browser's timezone (for date inputs). */
export function todayInputValue(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Coordinates for display, e.g. "30.356800, 76.362800". */
export function formatCoords(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return '—';
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}
