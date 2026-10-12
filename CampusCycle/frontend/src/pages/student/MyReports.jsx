import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Bike, Plus } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataState from '../../components/ui/DataState';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { maintenanceApi } from '../../services';
import { formatDateTime } from '../../utils/format';
import { categoryLabel, MAINTENANCE_STATUSES } from '../../utils/domain';

const FILTERS = [{ value: 'ALL', label: 'All' }, ...MAINTENANCE_STATUSES.map((s) => ({
  value: s,
  label: s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' '),
}))];

const PAGE_SIZE = 10;

/** The reports this student has submitted, and where each one stands. */
export default function MyReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await maintenanceApi.mine({
        status: filter === 'ALL' ? undefined : filter,
        limit: PAGE_SIZE,
        offset,
      });
      setReports(data.reports);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="My reports"
        subtitle="Issues you have reported and what has happened to them."
        actions={
          <Button onClick={() => navigate('/app/report')}>
            <Plus size={16} /> Report an issue
          </Button>
        }
      />

      <div
        className="mb-4 inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1"
        role="tablist"
        aria-label="Filter reports by status"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => {
              setFilter(f.value);
              setOffset(0);
            }}
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
        isEmpty={reports.length === 0}
        emptyIcon={Wrench}
        emptyTitle={filter === 'ALL' ? 'No reports yet' : 'No reports with this status'}
        emptyDescription="If you find a problem with a cycle, reporting it keeps the fleet safe for everyone."
        emptyAction={
          <Button onClick={() => navigate('/app/report')}>
            <Plus size={16} /> Report an issue
          </Button>
        }
      >
        <>
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium text-slate-900">
                        <Bike size={15} className="text-slate-400" />
                        {r.bicycle_code}
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-600">{categoryLabel(r.category)}</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{r.description}</p>
                      <p className="mt-1.5 text-xs text-slate-400">
                        Reported {formatDateTime(r.reported_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge kind="maintenance" status={r.status} />
                      <StatusBadge kind="severity" status={r.severity} withDot={false} />
                    </div>
                  </div>

                  {r.resolution_notes && (
                    <div className="mt-3 rounded-lg bg-emerald-50/70 p-3 text-sm">
                      <p className="text-xs font-medium text-emerald-800">
                        Maintenance team{r.resolved_by_name ? ` · ${r.resolved_by_name}` : ''}
                        {r.resolved_at ? ` · ${formatDateTime(r.resolved_at)}` : ''}
                      </p>
                      <p className="mt-0.5 text-slate-700">{r.resolution_notes}</p>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          <Pagination pagination={pagination} onChange={setOffset} loading={loading} />
        </>
      </DataState>
    </div>
  );
}
