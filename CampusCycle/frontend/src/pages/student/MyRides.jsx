import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Bike, ChevronRight } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataState from '../../components/ui/DataState';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import ReturnDialog from '../../components/ReturnDialog';
import { rentalsApi } from '../../services';
import { formatDateTime, formatSeconds } from '../../utils/format';

const FILTERS = [
  { value: 'ALL', label: 'All rides' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/**
 * The signed-in student's ride history. The backend derives the rides from
 * the authenticated token, so this screen can only ever show their own.
 */
export default function MyRides() {
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [returning, setReturning] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRides(await rentalsApi.mine(filter === 'ALL' ? undefined : { status: filter }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="My rides" subtitle="Your complete ride history on CampusCycle." />

      <div
        className="mb-4 inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1"
        role="tablist"
        aria-label="Filter rides by status"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={
              filter === f.value
                ? 'rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={load}
        isEmpty={rides.length === 0}
        emptyIcon={History}
        emptyTitle={filter === 'ALL' ? 'No rides yet' : `No ${filter.toLowerCase()} rides`}
        emptyDescription={
          filter === 'ALL'
            ? 'Once you start renting cycles, your rides will show up here.'
            : 'Try a different filter to see your other rides.'
        }
      >
        <Table>
          <THead>
            <Tr>
              <Th>Cycle</Th>
              <Th>Route</Th>
              <Th>Started</Th>
              <Th>Ended</Th>
              <Th>Duration</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </Tr>
          </THead>
          <TBody>
            {rides.map((r) => (
              <Tr
                key={r.id}
                className="cursor-pointer"
                onClick={() => navigate(`/app/rides/${r.id}`)}
              >
                <Td>
                  <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                    <Bike size={15} className="text-slate-400" />
                    {r.bicycle_code}
                  </span>
                </Td>
                <Td className="text-slate-600">
                  {r.start_station_name || '—'}
                  {r.end_station_name ? (
                    <span className="text-slate-400"> → {r.end_station_name}</span>
                  ) : (
                    <span className="text-slate-400"> → in progress</span>
                  )}
                </Td>
                <Td className="text-slate-600">{formatDateTime(r.started_at)}</Td>
                <Td className="text-slate-600">{formatDateTime(r.ended_at)}</Td>
                <Td className="tabular-nums text-slate-600">{formatSeconds(r.duration_seconds)}</Td>
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
                        End ride
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
