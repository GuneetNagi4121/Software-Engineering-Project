import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bike, MapPin } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import RentDialog from '../../components/RentDialog';
import { bicyclesApi, stationsApi, rentalsApi } from '../../services';
import { useToast } from '../../context/ToastContext';

export default function StationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [station, setStation] = useState(null);
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasActive, setHasActive] = useState(false);
  const [selectedBike, setSelectedBike] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, bikeList, active] = await Promise.all([
        stationsApi.get(id),
        bicyclesApi.list({ station_id: id }),
        rentalsApi.active().catch(() => null),
      ]);
      setStation(st);
      setBikes(bikeList);
      setHasActive(!!active);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-slate-400">
        <Spinner size={28} />
      </div>
    );
  }

  if (!station) {
    return (
      <EmptyState
        icon={MapPin}
        title="Station not found"
        action={
          <Button variant="secondary" onClick={() => navigate('/app/stations')}>
            Back to stations
          </Button>
        }
      />
    );
  }

  const available = bikes.filter((b) => b.status === 'AVAILABLE');
  const others = bikes.filter((b) => b.status !== 'AVAILABLE');

  return (
    <div>
      <button
        onClick={() => navigate('/app/stations')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} /> All stations
      </button>

      <PageHeader
        title={station.name}
        subtitle={station.location}
        actions={<StatusBadge kind="station" status={station.status} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Available</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{available.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Capacity</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{station.capacity}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Docked</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{bikes.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Status</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 capitalize">
            {station.status.toLowerCase()}
          </p>
        </Card>
      </div>

      <h3 className="mb-3 font-semibold text-slate-900">Available cycles</h3>

      {station.status !== 'ACTIVE' && (
        <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          This station is currently inactive. Cycles here may not be available to rent.
        </div>
      )}

      {available.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="No cycles available here"
          description="All cycles at this station are currently in use or under maintenance."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((bike) => (
            <Card key={bike.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Bike size={18} />
                </span>
                <div>
                  <p className="font-medium text-slate-900">{bike.cycle_code}</p>
                  <p className="font-mono text-xs text-slate-400">{bike.qr_code}</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setSelectedBike(bike)}
                disabled={hasActive || station.status !== 'ACTIVE'}
                title={hasActive ? 'You already have an active ride' : undefined}
              >
                Rent
              </Button>
            </Card>
          ))}
        </div>
      )}

      {hasActive && available.length > 0 && (
        <p className="mt-3 text-sm text-slate-500">
          You already have an active ride. End it before renting another cycle.
        </p>
      )}

      {others.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 font-semibold text-slate-900">Other cycles at this station</h3>
          <div className="flex flex-wrap gap-2">
            {others.map((bike) => (
              <span
                key={bike.id}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-slate-700">{bike.cycle_code}</span>
                <StatusBadge kind="bicycle" status={bike.status} withDot={false} />
              </span>
            ))}
          </div>
        </div>
      )}

      <RentDialog
        open={!!selectedBike}
        onClose={() => setSelectedBike(null)}
        onRented={() => {
          setSelectedBike(null);
          load();
        }}
        preselectedBike={selectedBike}
      />
    </div>
  );
}
