import { MapPin, Bike } from 'lucide-react';
import Card from './ui/Card';
import StatusBadge from './ui/StatusBadge';
import Button from './ui/Button';
import { cn } from '../utils/format';
import { AVAILABILITY_STYLE } from '../utils/domain';

/**
 * Station summary card.
 *
 * Availability figures (available_count, capacity, availability_pct,
 * availability_level) all come from the backend, which applies one shared
 * rule — so this card, the station list and the campus map always agree.
 */
export default function StationCard({ station, onView, onFindCycle }) {
  const capacity = Number(station.capacity) || 0;
  const available = Number(station.available_count) || 0;
  const pct = Number(station.availability_pct) || 0;
  const level = station.availability_level || 'INACTIVE';
  const style = AVAILABILITY_STYLE[level] || AVAILABILITY_STYLE.INACTIVE;

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
        <span className={cn('text-xs font-medium tabular-nums', style.text)}>
          {pct}% availability
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all', style.bar)}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${available} of ${capacity} cycles available at ${station.name}`}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusBadge kind="availability" status={level} />
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Bike size={13} /> {station.bikes_at_station ?? 0} docked
        </span>
      </div>

      {(onView || onFindCycle) && (
        <div className="mt-4 flex gap-2">
          {onView && (
            <Button variant="secondary" size="sm" onClick={onView} className="flex-1">
              View station
            </Button>
          )}
          {onFindCycle && (
            <Button
              size="sm"
              onClick={onFindCycle}
              className="flex-1"
              disabled={available === 0 || station.status !== 'ACTIVE'}
            >
              Find a cycle
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
