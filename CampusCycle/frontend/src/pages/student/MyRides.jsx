import { useCallback, useEffect, useState } from 'react';
import { History, Bike } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import ReturnDialog from '../../components/ReturnDialog';
import { rentalsApi } from '../../services';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, formatDuration } from '../../utils/format';

export default function MyRides() {
  const toast = useToast();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRides(await rentalsApi.mine());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="My rides" subtitle="Your complete ride history on CampusCycle." />

      {loading ? (
        <div className="grid place-items-center py-24 text-slate-400">
          <Spinner size={28} />
        </div>
      ) : rides.length === 0 ? (
        <EmptyState
          icon={History}
          title="No rides yet"
          description="Once you start renting cycles, your rides will show up here."
        />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Cycle</Th>
              <Th>Route</Th>
              <Th>Started</Th>
              <Th>Duration</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </Tr>
          </THead>
          <TBody>
            {rides.map((r) => (
              <Tr key={r.id}>
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
                <Td className="tabular-nums text-slate-600">
                  {formatDuration(r.started_at, r.ended_at)}
                </Td>
                <Td>
                  <StatusBadge kind="rental" status={r.status} />
                </Td>
                <Td className="text-right">
                  {r.status === 'ACTIVE' ? (
                    <Button size="sm" variant="secondary" onClick={() => setReturning(r)}>
                      End ride
                    </Button>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

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
