import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon, Info, RefreshCw, ShieldAlert } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataState from '../../components/ui/DataState';
import StatusBadge from '../../components/ui/StatusBadge';
import StationMap from '../../components/map/StationMap';
import MapLegend from '../../components/map/MapLegend';
import { stationsApi, geofenceApi } from '../../services';
import { formatCoords, formatDateTime } from '../../utils/format';

/**
 * Admin campus map: stations with live availability, the configured campus
 * boundary, and the last submitted (simulated) position of each bicycle.
 */
export default function AdminCampusMap() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [locations, setLocations] = useState([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [map, latest] = await Promise.all([
        stationsApi.map(),
        geofenceApi.latestLocations().catch(() => ({ locations: [], notice: '' })),
      ]);
      setData(map);
      setLocations(latest.locations || []);
      setNotice(latest.notice || '');
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
  const outside = locations.filter((l) => l.inside_boundary === false);

  return (
    <div>
      <PageHeader
        title="Campus map"
        subtitle="Stations, availability and the configured campus boundary."
        actions={
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw size={15} /> Refresh
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
        emptyDescription="Add a station with coordinates to see it on the map."
      >
        <div className="space-y-4">
          {stations.length === 0 ? (
            <Card className="flex items-start gap-3 p-5 text-sm text-slate-600">
              <Info size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <p>
                None of the {unmapped.length} station(s) have coordinates yet. Edit a station and
                add its latitude and longitude to put it on the map.
              </p>
            </Card>
          ) : (
            <StationMap
              stations={stations}
              geofence={data?.geofence}
              bicycleLocations={locations}
              height={520}
              renderPopup={(station) => (
                <div className="min-w-[210px] text-sm">
                  <p className="text-base font-semibold text-slate-900">{station.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{station.location}</p>
                  <dl className="mt-2.5 space-y-1">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Available</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {station.available_count} / {station.capacity}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Docked cycles</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {station.bikes_at_station}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Availability</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {station.availability_pct}%
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <StatusBadge kind="station" status={station.status} />
                    <StatusBadge kind="availability" status={station.availability_level} />
                  </div>
                  <div className="mt-3">
                    <Button size="sm" variant="secondary" onClick={() => navigate('/admin/stations')}>
                      Manage stations
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
              <MapLegend showBicycles={locations.length > 0} />
              <p className="text-xs text-slate-500">
                {data?.totals?.available_bicycles ?? 0} available ·{' '}
                {data?.totals?.mapped ?? 0}/{data?.totals?.stations ?? 0} stations mapped
              </p>
            </div>
          </Card>

          {locations.length > 0 && (
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert size={17} className="mt-0.5 shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    Simulated cycle positions ({locations.length})
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{notice}</p>
                  {outside.length > 0 && (
                    <p className="mt-2 text-xs text-rose-700">
                      {outside.length} cycle(s) last reported outside the boundary:{' '}
                      {outside.map((l) => l.bicycle_code).join(', ')}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    Most recent update:{' '}
                    {formatDateTime(
                      locations
                        .map((l) => l.recorded_at)
                        .sort()
                        .slice(-1)[0]
                    )}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {unmapped.length > 0 && stations.length > 0 && (
            <Card className="flex items-start gap-3 p-4 text-sm text-slate-600">
              <Info size={17} className="mt-0.5 shrink-0 text-amber-500" />
              <p>
                {unmapped.length} station(s) have no coordinates and are not shown:{' '}
                {unmapped.map((s) => s.name).join(', ')}.
              </p>
            </Card>
          )}
        </div>
      </DataState>
    </div>
  );
}
