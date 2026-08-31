import { MapPin, Bike } from 'lucide-react';
import Card from './ui/Card';
import StatusBadge from './ui/StatusBadge';
import Button from './ui/Button';
import { cn } from '../utils/format';

export default function StationCard({ station, onView }) {
  const capacity = Number(station.capacity) || 0;
  const available = Number(station.available_count) || 0;
  const pct = capacity > 0 ? Math.min(100, Math.round((available / capacity) * 100)) : 0;
  const barTone = available === 0 ? 'bg-slate-300' : available <= 2 ? 'bg-amber-500' : 'bg-brand-500';

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{station.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
            <MapPin size={12} /> {station.location}
          </p>
        </div>
        <StatusBadge kind="station" status={station.status} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{available}</span>
          <span className="text-sm text-slate-500">/ {capacity} available</span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Bike size={13} /> cycles
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', barTone)} style={{ width: `${pct}%` }} />
      </div>

      {onView && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onView} className="w-full">
            View station
          </Button>
        </div>
      )}
    </Card>
  );
}
