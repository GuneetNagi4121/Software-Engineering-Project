import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import StationCard from '../../components/StationCard';
import { Input } from '../../components/ui/Field';
import { stationsApi } from '../../services';
import { useToast } from '../../context/ToastContext';

export default function StudentStations() {
  const navigate = useNavigate();
  const toast = useToast();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setStations(await stationsApi.list());
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) => s.name.toLowerCase().includes(q) || s.location.toLowerCase().includes(q)
    );
  }, [stations, search]);

  return (
    <div>
      <PageHeader
        title="Stations"
        subtitle="Browse docking stations and live cycle availability across campus."
      />

      <div className="mb-5 max-w-sm">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stations"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-24 text-slate-400">
          <Spinner size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No stations found"
          description="Try a different search term."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <StationCard
              key={s.id}
              station={s}
              onView={() => navigate(`/app/stations/${s.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
