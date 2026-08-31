import { Bike, Clock, MapPin, Timer } from 'lucide-react';
import Button from './ui/Button';
import { useNow } from '../hooks/useNow';
import { formatDuration, formatTime } from '../utils/format';

/**
 * Prominent card for the student's currently active ride. The duration ticks
 * live off the backend-provided `started_at` timestamp (never a fake clock).
 */
export default function ActiveRideCard({ rental, onEnd }) {
  useNow(1000); // re-render each second for the live timer

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Active ride
          </span>
          <Bike size={22} className="opacity-80" />
        </div>

        <div>
          <p className="text-sm text-white/70">Cycle</p>
          <p className="text-2xl font-semibold tracking-tight">{rental.bicycle_code}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="flex items-center gap-1 text-xs text-white/70">
              <Timer size={13} /> Duration
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatDuration(rental.started_at)}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-white/70">
              <Clock size={13} /> Started
            </p>
            <p className="mt-0.5 text-lg font-semibold">{formatTime(rental.started_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-sm text-white/80">
          <MapPin size={14} /> From {rental.start_station_name || 'Unknown station'}
        </div>

        <Button
          variant="secondary"
          onClick={onEnd}
          className="w-full bg-white text-brand-700 ring-0 hover:bg-white/90"
        >
          End ride
        </Button>
      </div>
    </div>
  );
}
