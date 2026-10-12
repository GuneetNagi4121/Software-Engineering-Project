import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Search, MapPin, QrCode, Wrench } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataState from '../../components/ui/DataState';
import { Input } from '../../components/ui/Field';
import RentDialog from '../../components/RentDialog';
import { bicyclesApi, rentalsApi } from '../../services';

/**
 * "Find a Bicycle" — every cycle that is currently available, grouped by the
 * station it is parked at, straight from GET /api/bicycles?status=AVAILABLE.
 */
export default function FindCycle() {
  const navigate = useNavigate();
  const [bikes, setBikes] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, active] = await Promise.all([
        bicyclesApi.list({ status: 'AVAILABLE' }),
        rentalsApi.active().catch(() => null),
      ]);
      setBikes(list);
      setActiveRide(active);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = bikes.filter((b) => {
      if (b.on_safety_hold) return false; // never offer a cycle on safety hold
      if (!q) return true;
      return (
        b.cycle_code?.toLowerCase().includes(q) ||
        b.qr_code?.toLowerCase().includes(q) ||
        b.station_name?.toLowerCase().includes(q)
      );
    });

    const byStation = new Map();
    for (const bike of matches) {
      const key = bike.station_name || 'Unassigned';
      if (!byStation.has(key)) byStation.set(key, []);
      byStation.get(key).push(bike);
    }
    return [...byStation.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [bikes, search]);

  const total = grouped.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div>
      <PageHeader
        title="Find a bicycle"
        subtitle="Every cycle that is free to ride right now."
        actions={
          <Button variant="secondary" onClick={() => setScanOpen(true)} disabled={!!activeRide}>
            <QrCode size={16} /> Scan a QR code
          </Button>
        }
      />

      {activeRide && (
        <Card className="mb-5 flex flex-col gap-3 border-brand-200 bg-brand-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            You already have an active ride on{' '}
            <span className="font-semibold">{activeRide.bicycle_code}</span>. End it before renting
            another cycle.
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/app')}>
            Go to my ride
          </Button>
        </Card>
      )}

      <div className="mb-5 max-w-sm">
        <label htmlFor="bike-search" className="mb-1 block text-xs font-medium text-slate-600">
          Search
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            id="bike-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cycle code or station"
            className="pl-9"
          />
        </div>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={load}
        isEmpty={total === 0}
        emptyIcon={Bike}
        emptyTitle="No cycles available right now"
        emptyDescription="Every cycle is either out on a ride or under maintenance. Check back shortly."
      >
        <div className="space-y-6">
          <p className="text-sm text-slate-500" role="status">
            {total} cycle(s) available
          </p>
          {grouped.map(([stationName, list]) => (
            <section key={stationName}>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <MapPin size={14} className="text-slate-400" /> {stationName}
                <span className="font-normal text-slate-400">({list.length})</span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((bike) => (
                  <Card key={bike.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                        <Bike size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{bike.cycle_code}</p>
                        <p className="truncate font-mono text-xs text-slate-400">{bike.qr_code}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setSelected(bike)}
                      disabled={!!activeRide}
                      title={activeRide ? 'You already have an active ride' : undefined}
                    >
                      Rent
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          ))}

          <Card className="flex items-start gap-3 p-4 text-sm text-slate-600">
            <Wrench size={17} className="mt-0.5 shrink-0 text-slate-400" />
            <p>
              Something wrong with a cycle?{' '}
              <button
                type="button"
                onClick={() => navigate('/app/report')}
                className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
              >
                Report an issue
              </button>{' '}
              so the maintenance team can look at it.
            </p>
          </Card>
        </div>
      </DataState>

      <RentDialog
        open={!!selected || scanOpen}
        onClose={() => {
          setSelected(null);
          setScanOpen(false);
        }}
        onRented={() => {
          setSelected(null);
          setScanOpen(false);
          navigate('/app');
        }}
        preselectedBike={selected}
      />
    </div>
  );
}
