import { useCallback, useEffect, useState } from 'react';
import { Wrench, Bike, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import DataState from '../../components/ui/DataState';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Field, Select } from '../../components/ui/Field';
import { maintenanceApi, bicyclesApi, stationsApi } from '../../services';
import { useToast } from '../../context/ToastContext';
import { formatDateTime } from '../../utils/format';
import {
  categoryLabel,
  severityLabel,
  MAINTENANCE_STATUSES,
  MAINTENANCE_SEVERITIES,
} from '../../utils/domain';

const PAGE_SIZE = 15;

/** Transitions the backend allows; CLOSED is terminal. */
const ALLOWED_NEXT = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

const FINISHING = ['RESOLVED', 'CLOSED'];

function UpdateModal({ report, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [returning, setReturning] = useState(false);
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState('');

  useEffect(() => {
    if (!report) return;
    setStatus(ALLOWED_NEXT[report.status]?.[0] || '');
    setNotes(report.resolution_notes || '');
    setErrors({});
    setResult(null);
    setStationId(report.bicycle_station_id ? String(report.bicycle_station_id) : '');
  }, [report]);

  // Stations are needed only to put a cleared bicycle back into service.
  useEffect(() => {
    if (!result?.bicycle_can_return_to_service) return;
    let cancelled = false;
    stationsApi
      .list({ status: 'ACTIVE' })
      .then((list) => {
        if (!cancelled) setStations(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [result]);

  const needsNotes = FINISHING.includes(status);
  const options = report ? ALLOWED_NEXT[report.status] || [] : [];

  async function save() {
    setErrors({});
    if (!status) {
      setErrors({ status: 'Choose a new status' });
      return;
    }
    if (needsNotes && !notes.trim()) {
      setErrors({ resolution_notes: 'Explain what was done before closing the report' });
      return;
    }
    setSaving(true);
    try {
      const res = await maintenanceApi.updateStatus(report.id, {
        status,
        resolution_notes: notes.trim() || undefined,
      });
      toast.success(`Report #${report.id} is now ${status.toLowerCase().replace('_', ' ')}.`);
      setResult(res);
      onSaved();
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function returnToService() {
    if (!stationId) {
      setErrors({ station_id: 'Choose the station the cycle is parked at' });
      return;
    }
    setReturning(true);
    try {
      await bicyclesApi.changeStatus(report.bicycle_id, 'AVAILABLE', Number(stationId));
      toast.success(`${report.bicycle_code} is back in service.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReturning(false);
    }
  }

  if (!report) return null;

  return (
    <Modal
      open={!!report}
      onClose={saving || returning ? undefined : onClose}
      title={`Report #${report.id} — ${report.bicycle_code}`}
      description={categoryLabel(report.category)}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving || returning}>
            Close
          </Button>
          {options.length > 0 && !result && (
            <Button onClick={save} loading={saving}>
              Update status
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="maintenance" status={report.status} />
            <StatusBadge kind="severity" status={report.severity} withDot={false} />
            {report.bicycle_status === 'MAINTENANCE' && (
              <StatusBadge kind="bicycle" status="MAINTENANCE" />
            )}
          </div>
          <p className="mt-2.5 text-slate-700">{report.description}</p>
          <dl className="mt-3 grid gap-1.5 text-xs text-slate-500 sm:grid-cols-2">
            <div>
              <dt className="inline">Reported by </dt>
              <dd className="inline font-medium text-slate-700">{report.reported_by_name}</dd>
            </div>
            <div>
              <dt className="inline">Reported </dt>
              <dd className="inline font-medium text-slate-700">
                {formatDateTime(report.reported_at)}
              </dd>
            </div>
            <div>
              <dt className="inline">Cycle location </dt>
              <dd className="inline font-medium text-slate-700">
                {report.bicycle_station_name || 'out on a ride'}
              </dd>
            </div>
            {report.resolved_at && (
              <div>
                <dt className="inline">Resolved </dt>
                <dd className="inline font-medium text-slate-700">
                  {formatDateTime(report.resolved_at)}
                  {report.resolved_by_name ? ` by ${report.resolved_by_name}` : ''}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {options.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
            This report is closed and cannot be changed any further.
          </p>
        ) : (
          !result && (
            <>
              <Field label="New status" htmlFor="status" error={errors.status} required>
                <Select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  invalid={!!errors.status}
                >
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Resolution notes"
                htmlFor="notes"
                error={errors.resolution_notes}
                required={needsNotes}
                hint={
                  needsNotes
                    ? 'Required when resolving or closing a report.'
                    : 'Optional while the work is still in progress.'
                }
              >
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  placeholder="e.g. New brake pads and cable fitted; tested on site."
                  className={
                    'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset ' +
                    (errors.resolution_notes
                      ? 'ring-rose-400 focus:ring-rose-500'
                      : 'ring-slate-300 focus:ring-brand-600')
                  }
                />
              </Field>
            </>
          )
        )}

        {result && result.safety_hold && (
          <div
            className="flex items-start gap-2.5 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800"
            role="status"
          >
            <ShieldAlert size={17} className="mt-0.5 shrink-0" />
            <p>
              {result.open_safety_issues} safety issue(s) are still open on{' '}
              {report.bicycle_code}, so it stays out of service.
            </p>
          </div>
        )}

        {result && result.bicycle_can_return_to_service && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
            <p className="flex items-start gap-2 text-sm text-emerald-900">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              No safety issues remain on {report.bicycle_code}. It is still marked
              MAINTENANCE — put it back into service when it is physically parked and ready.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="sm:flex-1">
                <Field label="Parked at station" htmlFor="return-station" error={errors.station_id}>
                  <Select
                    id="return-station"
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    invalid={!!errors.station_id}
                  >
                    <option value="">Select a station…</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.available_count}/{s.capacity})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button onClick={returnToService} loading={returning}>
                Return to service
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function AdminMaintenance() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState(null);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, s] = await Promise.all([
        maintenanceApi.list({
          status: status || undefined,
          severity: severity || undefined,
          limit: PAGE_SIZE,
          offset,
        }),
        maintenanceApi.stats().catch(() => null),
      ]);
      setReports(data.reports);
      setPagination(data.pagination);
      setStats(s);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, severity, offset]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Issues reported against the fleet, and what has been done about them."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Open" value={stats?.OPEN ?? '—'} icon={AlertTriangle} tone="rose" />
        <StatCard label="In progress" value={stats?.IN_PROGRESS ?? '—'} icon={Wrench} tone="amber" />
        <StatCard label="Resolved" value={stats?.RESOLVED ?? '—'} icon={CheckCircle2} tone="emerald" />
        <StatCard label="All reports" value={stats?.TOTAL ?? '—'} icon={Bike} tone="slate" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-48">
          <label htmlFor="f-status" className="mb-1 block text-xs font-medium text-slate-600">
            Status
          </label>
          <Select
            id="f-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All statuses</option>
            {MAINTENANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-48">
          <label htmlFor="f-severity" className="mb-1 block text-xs font-medium text-slate-600">
            Severity
          </label>
          <Select
            id="f-severity"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All severities</option>
            {MAINTENANCE_SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {severityLabel(s.value)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={load}
        isEmpty={reports.length === 0}
        emptyIcon={Wrench}
        emptyTitle="No maintenance reports"
        emptyDescription={
          status || severity
            ? 'No reports match these filters.'
            : 'Nothing has been reported against the fleet yet.'
        }
      >
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Cycle</Th>
                <Th>Issue</Th>
                <Th>Severity</Th>
                <Th>Reported by</Th>
                <Th>Reported</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {reports.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium text-slate-900">{r.bicycle_code}</Td>
                  <Td className="max-w-[260px] whitespace-normal text-slate-600">
                    <span className="font-medium text-slate-700">{categoryLabel(r.category)}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {r.description}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge kind="severity" status={r.severity} withDot={false} />
                  </Td>
                  <Td className="text-slate-600">{r.reported_by_name}</Td>
                  <Td className="text-slate-600">{formatDateTime(r.reported_at)}</Td>
                  <Td>
                    <StatusBadge kind="maintenance" status={r.status} />
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                      {r.status === 'CLOSED' ? 'View' : 'Manage'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <Pagination pagination={pagination} onChange={setOffset} loading={loading} />
        </>
      </DataState>

      <UpdateModal report={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}
