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
