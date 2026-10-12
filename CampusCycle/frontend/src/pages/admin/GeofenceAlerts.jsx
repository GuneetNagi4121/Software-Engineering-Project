import { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  FlaskConical,
  RefreshCw,
  Info,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import DataState from '../../components/ui/DataState';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Field, Input, Select } from '../../components/ui/Field';
import { geofenceApi, bicyclesApi } from '../../services';
import { useToast } from '../../context/ToastContext';
import { formatCoords, formatDateTime } from '../../utils/format';

const PAGE_SIZE = 15;
const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];

/**
 * Demonstration-mode location simulator.
 *
 * CampusCycle has no GPS hardware on its bicycles, so there is no real
 * location feed. This panel submits an explicit, clearly-labelled SIMULATED
 * position for a chosen bicycle, which is exactly what the backend records.
 */
function SimulatorPanel({ bikes, geofence, onSubmitted }) {
  const toast = useToast();
  const [bicycleId, setBicycleId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // Offer the campus centre and a point outside as convenient starting values.
  const center = geofence?.bounds?.center;

  useEffect(() => {
    if (center && !latitude && !longitude) {
      setLatitude(String(center[0]));
      setLongitude(String(center[1]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geofence]);

  function useInside() {
    if (!center) return;
    setLatitude(String(center[0]));
    setLongitude(String(center[1]));
  }

  function useOutside() {
    const b = geofence?.bounds;
    if (!b) return;
    // A point clearly beyond the northern/eastern edge of the boundary.
    setLatitude((b.north + 0.01).toFixed(6));
    setLongitude((b.east + 0.01).toFixed(6));
  }

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    const next = {};
    if (!bicycleId) next.bicycle_id = 'Choose a cycle';
    if (latitude === '' || Number.isNaN(Number(latitude))) next.latitude = 'Enter a latitude';
    if (longitude === '' || Number.isNaN(Number(longitude))) next.longitude = 'Enter a longitude';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setSaving(true);
    try {
      const result = await geofenceApi.submitLocation({
        bicycle_id: Number(bicycleId),
        latitude: Number(latitude),
        longitude: Number(longitude),
        source: 'SIMULATED',
      });
      setLastResult(result);
      if (result.violation) {
        toast.error(
          result.duplicate_suppressed
            ? `Outside the boundary — folded into existing alert #${result.event.id}.`
            : `Boundary violation recorded as alert #${result.event.id}.`
        );
      } else {
        toast.success('Inside the campus boundary — no violation.');
      }
      onSubmitted();
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
          <FlaskConical size={18} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Demonstration mode — simulated locations
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            The bicycles have no GPS hardware, so there is no live location feed. Submit a position
            here to test boundary detection. Everything recorded this way is stored and labelled as
            SIMULATED, never mixed with real data.
          </p>
        </div>
      </div>

      <form className="space-y-3" onSubmit={submit} noValidate>
        <Field label="Cycle" htmlFor="sim-bike" error={errors.bicycle_id} required>
          <Select
            id="sim-bike"
            value={bicycleId}
            onChange={(e) => setBicycleId(e.target.value)}
            invalid={!!errors.bicycle_id}
          >
            <option value="">Select a cycle…</option>
            {bikes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.cycle_code} — {b.status.toLowerCase().replace('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" htmlFor="sim-lat" error={errors.latitude} required>
            <Input
              id="sim-lat"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              inputMode="decimal"
              placeholder="30.356400"
              className="font-mono"
              invalid={!!errors.latitude}
            />
          </Field>
          <Field label="Longitude" htmlFor="sim-lng" error={errors.longitude} required>
            <Input
              id="sim-lng"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              inputMode="decimal"
              placeholder="76.362500"
              className="font-mono"
              invalid={!!errors.longitude}
            />
          </Field>
        </div>

        {geofence?.bounds && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={useInside}>
              Use a point inside
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={useOutside}>
              Use a point outside
            </Button>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Submit simulated location
          </Button>
        </div>
      </form>

      {lastResult && (
        <div
          className={
            'mt-4 rounded-lg p-3 text-sm ' +
            (lastResult.violation
              ? 'border border-rose-100 bg-rose-50 text-rose-800'
              : 'border border-emerald-100 bg-emerald-50 text-emerald-800')
          }
          role="status"
        >
          <p className="font-medium">
            {lastResult.violation
              ? lastResult.duplicate_suppressed
                ? `Outside the boundary — no new alert (alert #${lastResult.event.id} now has ${lastResult.event.ping_count} pings)`
                : `Outside the boundary — alert #${lastResult.event.id} opened`
              : 'Inside the boundary — no violation'}
          </p>
          <p className="mt-0.5 font-mono text-xs opacity-80">
            {formatCoords(lastResult.ping.latitude, lastResult.ping.longitude)} ·{' '}
            {lastResult.ping.source}
          </p>
        </div>
      )}
    </Card>
  );
}

function AlertModal({ alert, onClose, onSaved }) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    setNotes(alert?.notes || '');
  }, [alert]);

  if (!alert) return null;

  async function setStatus(status) {
    setSaving(status);
    try {
      await geofenceApi.updateEvent(alert.id, { status, notes: notes.trim() || undefined });
      toast.success(`Alert #${alert.id} ${status.toLowerCase()}.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  }

  const canAcknowledge = alert.status === 'OPEN';
  const canResolve = alert.status !== 'RESOLVED';

  return (
    <Modal
      open={!!alert}
      onClose={saving ? undefined : onClose}
      title={`Alert #${alert.id} — ${alert.bicycle_code}`}
      description="Campus boundary violation"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={!!saving}>
            Close
          </Button>
          {canAcknowledge && (
            <Button
              variant="secondary"
              onClick={() => setStatus('ACKNOWLEDGED')}
              loading={saving === 'ACKNOWLEDGED'}
            >
              Acknowledge
            </Button>
          )}
          {canResolve && (
            <Button onClick={() => setStatus('RESOLVED')} loading={saving === 'RESOLVED'}>
              Resolve
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="alert" status={alert.status} />
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {alert.source}
          </span>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">First detected</dt>
            <dd className="font-medium text-slate-900">{formatDateTime(alert.occurred_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Last seen outside</dt>
            <dd className="font-medium text-slate-900">{formatDateTime(alert.last_seen_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Location at detection</dt>
            <dd className="font-mono text-xs text-slate-700">
              {formatCoords(alert.latitude, alert.longitude)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Last known location</dt>
            <dd className="font-mono text-xs text-slate-700">
              {formatCoords(alert.last_latitude, alert.last_longitude)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Out-of-bounds updates</dt>
            <dd className="font-medium tabular-nums text-slate-900">{alert.ping_count}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Rider at the time</dt>
            <dd className="font-medium text-slate-900">{alert.rider_name || 'No active ride'}</dd>
          </div>
          {alert.returned_inside_at && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Seen back inside</dt>
              <dd className="font-medium text-emerald-700">
                {formatDateTime(alert.returned_inside_at)}
              </dd>
            </div>
          )}
          {alert.acknowledged_at && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Acknowledged</dt>
              <dd className="font-medium text-slate-900">
                {formatDateTime(alert.acknowledged_at)}
                {alert.acknowledged_by_name ? ` by ${alert.acknowledged_by_name}` : ''}
              </dd>
            </div>
          )}
          {alert.resolved_at && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Resolved</dt>
              <dd className="font-medium text-slate-900">
                {formatDateTime(alert.resolved_at)}
                {alert.resolved_by_name ? ` by ${alert.resolved_by_name}` : ''}
              </dd>
            </div>
          )}
        </dl>

        {alert.status === 'RESOLVED' ? (
          alert.notes && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{alert.notes}</div>
          )
        ) : (
          <Field label="Notes" htmlFor="alert-notes" hint="Saved with your acknowledgement or resolution.">
            <textarea
              id="alert-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              placeholder="e.g. Security team notified; cycle recovered from the main gate."
              className="block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600"
            />
          </Field>
        )}

        <p className="flex items-start gap-2 text-xs text-slate-500">
          <Info size={14} className="mt-0.5 shrink-0" />
          Repeated out-of-bounds updates for the same cycle are counted on this one alert rather
          than creating duplicates.
        </p>
      </div>
    </Modal>
  );
}

export default function AdminGeofenceAlerts() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [bikes, setBikes] = useState([]);
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, s, cfg, bikeList] = await Promise.all([
        geofenceApi.events({ status: status || undefined, limit: PAGE_SIZE, offset }),
        geofenceApi.eventStats().catch(() => null),
        geofenceApi.config().catch(() => null),
        bicyclesApi.list().catch(() => []),
      ]);
      setEvents(data.events);
      setPagination(data.pagination);
      setStats(s);
      setConfig(cfg);
      setBikes(bikeList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, offset]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Geofence alerts"
        subtitle="Bicycles reported outside the configured campus boundary."
        actions={
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Open" value={stats?.OPEN ?? '—'} icon={AlertTriangle} tone="rose" />
        <StatCard
          label="Acknowledged"
          value={stats?.ACKNOWLEDGED ?? '—'}
          icon={ShieldAlert}
          tone="amber"
        />
        <StatCard label="Resolved" value={stats?.RESOLVED ?? '—'} icon={CheckCircle2} tone="emerald" />
        <StatCard label="All alerts" value={stats?.TOTAL ?? '—'} icon={MapPin} tone="slate" />
      </div>

      {config && !config.configured && (
        <Card className="mb-6 flex items-start gap-3 border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <p>
            No campus boundary is configured, so locations cannot be checked. Install one with{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 text-xs">npm run db:seed:phase2</code>{' '}
            or by calling <code className="rounded bg-white/70 px-1 py-0.5 text-xs">PUT /api/geofence</code>.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 sm:w-48">
            <label htmlFor="alert-status" className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <Select
              id="alert-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All alerts</option>
              {ALERT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </div>

          <DataState
            loading={loading}
            error={error}
            onRetry={load}
            isEmpty={events.length === 0}
            emptyIcon={ShieldAlert}
            emptyTitle={status ? 'No alerts with this status' : 'No boundary violations'}
            emptyDescription={
              status
                ? 'Try a different status filter.'
                : 'No bicycle has been reported outside the campus boundary.'
            }
          >
            <>
              <Table>
                <THead>
                  <Tr>
                    <Th>Cycle</Th>
                    <Th>Detected</Th>
                    <Th>Last seen</Th>
                    <Th>Updates</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Action</Th>
                  </Tr>
                </THead>
                <TBody>
                  {events.map((e) => (
                    <Tr key={e.id}>
                      <Td className="font-medium text-slate-900">{e.bicycle_code}</Td>
                      <Td className="text-slate-600">{formatDateTime(e.occurred_at)}</Td>
                      <Td className="text-slate-600">
                        {formatDateTime(e.last_seen_at)}
                        {e.returned_inside_at && (
                          <span className="mt-0.5 block text-xs text-emerald-700">
                            back inside {formatDateTime(e.returned_inside_at)}
                          </span>
                        )}
                      </Td>
                      <Td className="tabular-nums text-slate-600">{e.ping_count}</Td>
                      <Td>
                        <StatusBadge kind="alert" status={e.status} />
                      </Td>
                      <Td className="text-right">
                        <Button size="sm" variant="secondary" onClick={() => setSelected(e)}>
                          {e.status === 'RESOLVED' ? 'View' : 'Manage'}
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>

              <Pagination pagination={pagination} onChange={setOffset} loading={loading} />
            </>
          </DataState>
        </div>

        <div className="space-y-4">
          <SimulatorPanel bikes={bikes} geofence={config?.geofence} onSubmitted={load} />

          {config?.geofence && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-slate-900">Active boundary</h3>
              <p className="mt-1 text-sm text-slate-700">{config.geofence.name}</p>
              {config.geofence.description && (
                <p className="mt-1 text-xs text-slate-500">{config.geofence.description}</p>
              )}
              <dl className="mt-3 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between gap-3">
                  <dt>Vertices</dt>
                  <dd className="tabular-nums text-slate-700">{config.geofence.polygon.length}</dd>
                </div>
                {config.geofence.bounds && (
                  <div className="flex justify-between gap-3">
                    <dt>Centre</dt>
                    <dd className="font-mono text-slate-700">
                      {formatCoords(
                        config.geofence.bounds.center[0],
                        config.geofence.bounds.center[1]
                      )}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt>Updated</dt>
                  <dd className="text-slate-700">{formatDateTime(config.geofence.updated_at)}</dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                Replace it with <code className="text-[11px]">PUT /api/geofence</code>, passing a
                polygon of at least three [latitude, longitude] points.
              </p>
            </Card>
          )}
        </div>
      </div>

      <AlertModal alert={selected} onClose={() => setSelected(null)} onSaved={load} />
    </div>
  );
}
