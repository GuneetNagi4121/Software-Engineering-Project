import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Route as RouteIcon, ChevronRight } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import DataState from '../../components/ui/DataState';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Input, Select } from '../../components/ui/Field';
import ReturnDialog from '../../components/ReturnDialog';
import { rentalsApi, bicyclesApi, stationsApi } from '../../services';
import { formatDateTime, formatSeconds } from '../../utils/format';

const STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'];
const PAGE_SIZE = 20;

/**
 * Every ride across the network, with date-range, bicycle, station and status
 * filters plus pagination. The backend caps the page size, so this screen
 * never pulls an unbounded result set.
 */
export default function AdminRentals() {
  const navigate = useNavigate();
  const [rentals, setRentals] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [bikes, setBikes] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [returning, setReturning] = useState(null);

  const [filters, setFilters] = useState({
    status: '',
    bicycle_id: '',
    station_id: '',
    from: '',
    to: '',
  });
  const [offset, setOffset] = useState(0);

  // Filter option lists.
  useEffect(() => {
    let cancelled = false;
    Promise.all([bicyclesApi.list().catch(() => []), stationsApi.list().catch(() => [])]).then(
      ([b, s]) => {
        if (cancelled) return;
        setBikes(b);
        setStations(s);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: PAGE_SIZE, offset };
      for (const [key, value] of Object.entries(filters)) {
        if (value) params[key] = value;
      }
      const data = await rentalsApi.listAll(params);
      setRentals(data.rentals);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    load();
  }, [load]);

  function update(key) {
    return (e) => {
      setFilters((f) => ({ ...f, [key]: e.target.value }));
      setOffset(0);
    };
  }

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader title="Rentals" subtitle="Every ride across the campus network." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="r-status" className="mb-1 block text-xs font-medium text-slate-600">
            Status
          </label>
          <Select id="r-status" value={filters.status} onChange={update('status')}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="r-bike" className="mb-1 block text-xs font-medium text-slate-600">
            Cycle
          </label>
          <Select id="r-bike" value={filters.bicycle_id} onChange={update('bicycle_id')}>
            <option value="">All cycles</option>
            {bikes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.cycle_code}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="r-station" className="mb-1 block text-xs font-medium text-slate-600">
            Station
          </label>
          <Select id="r-station" value={filters.station_id} onChange={update('station_id')}>
            <option value="">All stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="r-from" className="mb-1 block text-xs font-medium text-slate-600">
            Started from
          </label>
          <Input
            id="r-from"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={update('from')}
          />
        </div>
        <div>
          <label htmlFor="r-to" className="mb-1 block text-xs font-medium text-slate-600">
            Started to
          </label>
          <Input
            id="r-to"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={update('to')}
          />
        </div>
      </div>

      {hasFilters && (
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({ status: '', bicycle_id: '', station_id: '', from: '', to: '' });
              setOffset(0);
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      <DataState
        loading={loading}
        error={error}
        onRetry={load}
        isEmpty={rentals.length === 0}
        emptyIcon={RouteIcon}
        emptyTitle="No rentals found"
        emptyDescription={hasFilters ? 'Try a different filter.' : 'No rides have been taken yet.'}
      >
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Student</Th>
                <Th>Cycle</Th>
                <Th>Route</Th>
                <Th>Started</Th>
                <Th>Duration</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {rentals.map((r) => (
                <Tr
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/admin/rentals/${r.id}`)}
                >
                  <Td className="font-medium text-slate-900">{r.user_name}</Td>
                  <Td>{r.bicycle_code}</Td>
                  <Td className="text-slate-600">
                    {r.start_station_name || '—'}
                    {r.end_station_name ? (
                      <span className="text-slate-400"> → {r.end_station_name}</span>
                    ) : (
                      <span className="text-slate-400"> → in progress</span>
                    )}
                  </Td>
                  <Td className="text-slate-600">{formatDateTime(r.started_at)}</Td>
                  <Td className="tabular-nums text-slate-600">
                    {formatSeconds(r.duration_seconds)}
                  </Td>
                  <Td>
                    <StatusBadge kind="rental" status={r.status} />
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReturning(r);
                          }}
                        >
                          Force end
                        </Button>
                      )}
                      <ChevronRight size={16} className="text-slate-300" aria-hidden />
                      <span className="sr-only">View ride details</span>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <Pagination pagination={pagination} onChange={setOffset} loading={loading} />
        </>
      </DataState>

      {returning && (
        <ReturnDialog
          open={!!returning}
          onClose={() => setReturning(null)}
          onReturned={() => {
            setReturning(null);
            load();
          }}
          rental={returning}
        />
      )}
    </div>
  );
}
