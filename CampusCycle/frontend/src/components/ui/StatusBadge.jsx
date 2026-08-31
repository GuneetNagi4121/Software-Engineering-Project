import Badge from './Badge';
import { cn } from '../../utils/format';

// Maps each domain status to a visual tone + human label.
const MAPS = {
  bicycle: {
    AVAILABLE: { tone: 'emerald', label: 'Available' },
    IN_USE: { tone: 'blue', label: 'In use' },
    RESERVED: { tone: 'violet', label: 'Reserved' },
    MAINTENANCE: { tone: 'amber', label: 'Maintenance' },
  },
  rental: {
    ACTIVE: { tone: 'emerald', label: 'Active' },
    COMPLETED: { tone: 'slate', label: 'Completed' },
    CANCELLED: { tone: 'rose', label: 'Cancelled' },
  },
  station: {
    ACTIVE: { tone: 'emerald', label: 'Active' },
    INACTIVE: { tone: 'slate', label: 'Inactive' },
  },
};

const DOT = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
};

export default function StatusBadge({ kind, status, withDot = true }) {
  const cfg = MAPS[kind]?.[status] || { tone: 'slate', label: status };
  return (
    <Badge tone={cfg.tone}>
      {withDot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT[cfg.tone])} />}
      {cfg.label}
    </Badge>
  );
}
