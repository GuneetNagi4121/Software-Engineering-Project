import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Map as MapIcon } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import DataState from '../../components/ui/DataState';
import StationCard from '../../components/StationCard';
import RentDialog from '../../components/RentDialog';
import { Input, Select } from '../../components/ui/Field';
import { stationsApi } from '../../services';
import { AVAILABILITY_LEVELS } from '../../utils/domain';

const SORTS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'availability_desc', label: 'Most cycles available' },
  { value: 'availability', label: 'Fewest cycles available' },
];

/**
 * Station list with live availability, filtering by availability level and
 * sorting by how many cycles are free. Filtering and sorting happen on the
 * backend so the rules match the map exactly; the text search is local.
 */
export default function StudentStations() {
  const navigate = useNavigate();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('');
  const [sort, setSort] = useState('name');
  const [rentOpen, setRentOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStations(
        await stationsApi.list({
          availability: availability || undefined,
          sort: sort === 'name' ? undefined : sort,
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [availability, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) => s.name.toLowerCase().includes(q) || s.location.toLowerCase().includes(q)
    );
  }, [stations, search]);

  const totalAvailable = filtered.reduce((sum, s) => sum + (s.available_count || 0), 0);

  return (
    <div>
      <PageHeader
        title="Stations"
        subtitle="Browse docking stations and live cycle availability across campus."
        actions={
          <Button variant="secondary" onClick={() => navigate('/app/map')}>
            <MapIcon size={16} /> View on map
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:max-w-xs sm:flex-1">
          <label htmlFor="station-search" className="mb-1 block text-xs font-medium text-slate-600">
            Search
          </label>
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              id="station-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Station or location"
              className="pl-9"
            />
          </div>
        </div>

        <div className="sm:w-52">
          <label htmlFor="availability" className="mb-1 block text-xs font-medium text-slate-600">
            Availability
          </label>
          <Select
            id="availability"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="">All stations</option>
            {AVAILABILITY_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="sm:w-52">
          <label htmlFor="sort" className="mb-1 block text-xs font-medium text-slate-600">
            Sort by
          </label>
          <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={load}
        isEmpty={filtered.length === 0}
        emptyIcon={MapIcon}
        emptyTitle="No stations match these filters"
        emptyDescription="Try a different availability filter or search term."
        emptyAction={
          (availability || search) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAvailability('');
                setSearch('');
              }}
            >
              Clear filters
            </Button>
          )
        }
      >
        <>
          <p className="mb-3 text-sm text-slate-500" role="status">
            {filtered.length} station(s) · {totalAvailable} cycle(s) available
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <StationCard
                key={s.id}
                station={s}
                onView={() => navigate(`/app/stations/${s.id}`)}
                onFindCycle={() => setRentOpen(true)}
              />
            ))}
          </div>
        </>
      </DataState>

      <RentDialog open={rentOpen} onClose={() => setRentOpen(false)} onRented={load} />
    </div>
  );
}
