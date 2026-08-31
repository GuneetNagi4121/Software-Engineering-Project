import { useCallback, useEffect, useState } from 'react';
import { Route as RouteIcon } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Select } from '../../components/ui/Field';
import ReturnDialog from '../../components/ReturnDialog';
import { rentalsApi } from '../../services';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, formatDuration } from '../../utils/format';

const FILTERS = ['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

export default function AdminRentals() {
  const toast = useToast();
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [returning, setReturning] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter === 'ALL' ? {} : { status: statusFilter };
      setRentals(await rentalsApi.listAll(params));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Rentals" subtitle="Every ride across the campus network." />

      <div className="mb-4 w-full sm:w-48">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f === 'ALL' ? 'All statuses' : f.charAt(0) + f.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-24 text-slate-400">
          <Spinner size={28} />
        </div>
      ) : rentals.length === 0 ? (
        <EmptyState icon={RouteIcon} title="No rentals found" description="Try a different filter." />
      ) : (
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
              <Tr key={r.id}>
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
                  {formatDuration(r.started_at, r.ended_at)}
                </Td>
                <Td>
                  <StatusBadge kind="rental" status={r.status} />
                </Td>
                <Td className="text-right">
                  {r.status === 'ACTIVE' ? (
                    <Button size="sm" variant="secondary" onClick={() => setReturning(r)}>
                      Force end
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
