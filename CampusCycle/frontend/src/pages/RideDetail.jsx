import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bike, Clock, MapPin, Route as RouteIcon, Timer, User, Wrench } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataState from '../components/ui/DataState';
import StatusBadge from '../components/ui/StatusBadge';
import ReturnDialog from '../components/ReturnDialog';
import { useAuth } from '../context/AuthContext';
import { useNow } from '../hooks/useNow';
import { rentalsApi } from '../services';
import { formatDateTime, formatSeconds } from '../utils/format';

/**
 * One ride in detail. Shared by the student area (/app/rides/:id) and the
 * admin area (/admin/rentals/:id) — the backend decides what the signed-in
 * user is allowed to see, and returns 403 for someone else's ride.
 */
export default function RideDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [returning, setReturning] = useState(false);

  // Tick once a second so an active ride's duration stays live.
  const now = useNow(1000);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRide(await rentalsApi.get(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const backTo = isAdmin ? '/admin/rentals' : '/app/rides';

  // For an active ride, recompute the elapsed time in the browser from the
  // server's start timestamp rather than letting the fetched value go stale.
  const liveSeconds =
    ride && ride.status === 'ACTIVE' && ride.started_at
      ? Math.max(0, Math.floor((now - new Date(ride.started_at).getTime()) / 1000))
      : ride?.duration_seconds;

  return (
    <div>
      <button
        onClick={() => navigate(backTo)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} /> {isAdmin ? 'All rentals' : 'My rides'}
      </button>

      <DataState
        loading={loading}
        error={error}
        onRetry={load}
        isEmpty={!ride}
        emptyIcon={RouteIcon}
        emptyTitle="Ride not found"
        emptyAction={
          <Button variant="secondary" onClick={() => navigate(backTo)}>
            Go back
          </Button>
        }
      >
        {ride && (
          <>
            <PageHeader
              title={`Ride #${ride.id}`}
              subtitle={`Cycle ${ride.bicycle_code}`}
              actions={
                <div className="flex items-center gap-2">
                  <StatusBadge kind="rental" status={ride.status} />
                  {ride.status === 'ACTIVE' && (
                    <Button size="sm" variant="secondary" onClick={() => setReturning(true)}>
                      {isAdmin ? 'Force end' : 'End ride'}
                    </Button>
                  )}
                </div>
              }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Timer size={14} /> Duration
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                  {formatSeconds(liveSeconds)}
                </p>
                {ride.status === 'ACTIVE' && (
                  <p className="mt-1 text-xs text-brand-700">Still running</p>
                )}
              </Card>
              <Card className="p-4">
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Clock size={14} /> Started
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {formatDateTime(ride.started_at)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Clock size={14} /> Ended
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {ride.ended_at ? formatDateTime(ride.ended_at) : 'In progress'}
                </p>
              </Card>
              <Card className="p-4">
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Bike size={14} /> Cycle status
                </p>
                <p className="mt-1">
                  <StatusBadge kind="bicycle" status={ride.bicycle_status} />
                </p>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Route</h3>
                <ol className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                      <MapPin size={14} />
                    </span>
                    <div>
                      <p className="text-xs text-slate-500">Picked up at</p>
                      <p className="font-medium text-slate-900">
                        {ride.start_station_name || 'Unknown station'}
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                      <MapPin size={14} />
                    </span>
                    <div>
                      <p className="text-xs text-slate-500">Returned to</p>
                      <p className="font-medium text-slate-900">
                        {ride.end_station_name || 'Not returned yet'}
                      </p>
                    </div>
                  </li>
                </ol>
              </Card>

              <Card className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Details</h3>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Cycle code</dt>
                    <dd className="font-medium text-slate-900">{ride.bicycle_code}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">QR code</dt>
                    <dd className="font-mono text-xs text-slate-600">{ride.bicycle_qr}</dd>
                  </div>
                  {isAdmin && (
                    <div className="flex justify-between gap-4">
                      <dt className="flex items-center gap-1.5 text-slate-500">
                        <User size={13} /> Rider
                      </dt>
                      <dd className="font-medium text-slate-900">{ride.user_name}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Ride id</dt>
                    <dd className="tabular-nums text-slate-600">#{ride.id}</dd>
                  </div>
                </dl>

                {!isAdmin && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/app/report?bicycle=${ride.bicycle_id}`)}
                    >
                      <Wrench size={15} /> Report an issue with this cycle
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            {returning && (
              <ReturnDialog
                open={returning}
                onClose={() => setReturning(false)}
                onReturned={() => {
                  setReturning(false);
                  load();
                }}
                rental={ride}
              />
            )}
          </>
        )}
      </DataState>
    </div>
  );
}
