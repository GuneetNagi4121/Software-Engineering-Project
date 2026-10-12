/**
 * Human labels for the Phase 2 domain enums. The values themselves are
 * defined by the backend (backend/src/utils/constants.js) and the database
 * CHECK constraints; this file only decides how to show them.
 */

export const MAINTENANCE_CATEGORIES = [
  { value: 'BRAKES', label: 'Brake problem' },
  { value: 'TYRE', label: 'Flat or damaged tyre' },
  { value: 'CHAIN', label: 'Broken or slipping chain' },
  { value: 'LIGHT', label: 'Faulty light' },
  { value: 'SEAT', label: 'Seat damage' },
  { value: 'OTHER', label: 'Other mechanical issue' },
];

export const MAINTENANCE_SEVERITIES = [
  { value: 'LOW', label: 'Low — cosmetic or minor' },
  { value: 'MEDIUM', label: 'Medium — annoying but rideable' },
  { value: 'HIGH', label: 'High — unsafe to ride' },
  { value: 'CRITICAL', label: 'Critical — do not ride' },
];

export const MAINTENANCE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

/** Severities that take a bicycle out of service until a mechanic clears it. */
export const SAFETY_SEVERITIES = ['HIGH', 'CRITICAL'];

export const AVAILABILITY_LEVELS = [
  { value: 'GOOD', label: 'Good availability' },
  { value: 'LOW', label: 'Low availability' },
  { value: 'NONE', label: 'No cycles available' },
  { value: 'INACTIVE', label: 'Inactive stations' },
];

export function categoryLabel(value) {
  return MAINTENANCE_CATEGORIES.find((c) => c.value === value)?.label || value;
}

/** Short label without the explanatory dash, for tables and badges. */
export function severityLabel(value) {
  const full = MAINTENANCE_SEVERITIES.find((s) => s.value === value)?.label;
  return full ? full.split(' — ')[0] : value;
}

export function statusLabel(value) {
  if (!value) return '—';
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
}

/** Tailwind colour tokens per availability level — one source for map + list. */
export const AVAILABILITY_STYLE = {
  GOOD: { dot: '#059669', ring: 'ring-emerald-200', text: 'text-emerald-700', bar: 'bg-brand-500' },
  LOW: { dot: '#d97706', ring: 'ring-amber-200', text: 'text-amber-700', bar: 'bg-amber-500' },
  NONE: { dot: '#e11d48', ring: 'ring-rose-200', text: 'text-rose-700', bar: 'bg-rose-400' },
  INACTIVE: { dot: '#94a3b8', ring: 'ring-slate-200', text: 'text-slate-500', bar: 'bg-slate-300' },
};
