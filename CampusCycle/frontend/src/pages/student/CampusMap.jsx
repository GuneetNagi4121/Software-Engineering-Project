import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon, Bike, Info } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataState from '../../components/ui/DataState';
import StatusBadge from '../../components/ui/StatusBadge';
import StationMap from '../../components/map/StationMap';
import MapLegend from '../../components/map/MapLegend';
import RentDialog from '../../components/RentDialog';
import { stationsApi } from '../../services';
import { formatCoords } from '../../utils/format';

/**
 * Student campus map. Every marker and count is drawn from
 * GET /api/stations/map — no availability figure is hard-coded here.
 */
export default function StudentCampusMap() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rentOpen, setRentOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await stationsApi.map());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stations = data?.stations || [];
  const unmapped = data?.unmapped_stations || [];

  return (
    <div>
      <PageHeader
        title="Campus map"
        subtitle="Live cycle availability at every station on campus."
        actions={
          <Button onClick={() => setRentOpen(true)}>
            <Bike size={16} /> Find a cycle
          </Button>
        }
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={load}
        isEmpty={stations.length === 0 && unmapped.length === 0}
        emptyIcon={MapIcon}
        emptyTitle="No stations yet"
        emptyDescription="Once stations are added they will appear on this map."
      >
        <div className="space-y-4">
          {stations.length === 0 ? (
            <Card className="flex items-start gap-3 p-5 text-sm text-slate-600">
              <Info size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <p>
                None of the {unmapped.length} station(s) have coordinates yet, so there is nothing
                to draw. An administrator can add coordinates from the Stations screen.
              </p>
            </Card>
          ) : (
            <StationMap
              stations={stations}
              geofence={data?.geofence}
              height={480}
              renderPopup={(station) => (
                <div className="min-w-[200px] text-sm">
                  <p className="text-base font-semibold text-slate-900">{station.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{station.location}</p>

                  <dl className="mt-2.5 space-y-1">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Available cycles</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {station.available_count}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Total capacity</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {station.capacity}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Availability</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {station.availability_pct}%
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-2.5">
                    <StatusBadge kind="availability" status={station.availability_level} />
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/app/stations/${station.id}`)}
                    >
                      View station
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setRentOpen(true)}
                      disabled={station.available_count === 0 || station.status !== 'ACTIVE'}
                    >
                      Find a bicycle
                    </Button>
                  </div>

                  <p className="mt-2 font-mono text-[11px] text-slate-400">
                    {formatCoords(station.latitude, station.longitude)}
                  </p>
                </div>
              )}
            />
          )}

          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <MapLegend />
              <p className="text-xs text-slate-500">
                {data?.totals?.available_bicycles ?? 0} cycles available across{' '}
                {data?.totals?.mapped ?? 0} mapped station(s)
              </p>
            </div>
          </Card>

          {unmapped.length > 0 && stations.length > 0 && (
            <Card className="flex items-start gap-3 p-4 text-sm text-slate-600">
              <Info size={17} className="mt-0.5 shrink-0 text-amber-500" />
              <p>
                {unmapped.length} station(s) are not on the map yet because they have no
                coordinates: {unmapped.map((s) => s.name).join(', ')}.
              </p>
            </Card>
          )}
        </div>
      </DataState>

      <RentDialog open={rentOpen} onClose={() => setRentOpen(false)} onRented={load} />
    </div>
  );
}
