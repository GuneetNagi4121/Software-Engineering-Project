import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Bike, QrCode, Wrench } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataState from '../../components/ui/DataState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Field, Input, Select } from '../../components/ui/Field';
import { bicyclesApi, maintenanceApi, rentalsApi } from '../../services';
import { useToast } from '../../context/ToastContext';
import {
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_SEVERITIES,
  SAFETY_SEVERITIES,
} from '../../utils/domain';

const DESCRIPTION_MAX = 1000;

/**
 * Report a problem with a bicycle.
 *
 * The cycle can be chosen from the list, pre-filled from a ride
 * (?bicycle=<id>), or identified by typing/scanning its QR code — the same
 * identification the rental flow uses.
 */
export default function ReportIssue() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const [bikes, setBikes] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [bicycleId, setBicycleId] = useState('');
  const [qrLookup, setQrLookup] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // Every bicycle, so a cycle already in maintenance can still be reported.
      const [list, active] = await Promise.all([
        bicyclesApi.list(),
        rentalsApi.active().catch(() => null),
      ]);
      setBikes(list);
      setActiveRide(active);

      const preset = params.get('bicycle');
      if (preset && list.some((b) => String(b.id) === String(preset))) {
        setBicycleId(String(preset));
      } else if (active) {
        setBicycleId(String(active.bicycle_id));
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedBike = useMemo(
    () => bikes.find((b) => String(b.id) === String(bicycleId)) || null,
    [bikes, bicycleId]
  );

  const isSafetyIssue = SAFETY_SEVERITIES.includes(severity);

  /** Resolve a typed/scanned QR code to a bicycle in the loaded list. */
  function applyQrLookup() {
    const code = qrLookup.trim().toLowerCase();
    if (!code) return;
    const match = bikes.find(
      (b) => b.qr_code?.toLowerCase() === code || b.cycle_code?.toLowerCase() === code
    );
    if (match) {
      setBicycleId(String(match.id));
      setErrors((e) => ({ ...e, bicycle_id: undefined }));
      toast.success(`Selected ${match.cycle_code}.`);
    } else {
      toast.error('No cycle matches that code.');
    }
  }

  function validate() {
    const next = {};
    if (!bicycleId) next.bicycle_id = 'Choose the cycle you are reporting';
    if (!category) next.category = 'Pick the kind of problem';
    if (!description.trim()) next.description = 'Describe the problem';
    if (description.length > DESCRIPTION_MAX) {
      next.description = `Keep it under ${DESCRIPTION_MAX} characters`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setConfirmOpen(true);
  }

  async function submitReport() {
    setSaving(true);
    try {
      const result = await maintenanceApi.report({
        bicycle_id: Number(bicycleId),
        category,
        severity,
        description: description.trim(),
      });
      toast.success(result.message || 'Report submitted.');
      setConfirmOpen(false);
      navigate('/app/reports');
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      toast.error(err.message);
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Report an issue"
        subtitle="Tell the maintenance team what is wrong with a cycle."
      />

      <DataState loading={loading} error={loadError} onRetry={load}>
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <Card className="space-y-4 p-5">
            <Field
              label="Which cycle?"
              htmlFor="bicycle"
              error={errors.bicycle_id}
              required
              hint={
                activeRide && String(activeRide.bicycle_id) === String(bicycleId)
                  ? 'This is the cycle you are riding right now.'
                  : undefined
              }
            >
              <Select
                id="bicycle"
                value={bicycleId}
                onChange={(e) => setBicycleId(e.target.value)}
                invalid={!!errors.bicycle_id}
              >
                <option value="">Select a cycle…</option>
                {bikes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.cycle_code} — {b.station_name || 'out on a ride'}
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <label htmlFor="qr" className="mb-1 block text-sm font-medium text-slate-700">
                …or enter the code printed on the cycle
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <QrCode
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    id="qr"
                    value={qrLookup}
                    onChange={(e) => setQrLookup(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyQrLookup();
                      }
                    }}
                    placeholder="CYCLE-TC-001"
                    className="pl-9 font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={applyQrLookup}>
                  Find
                </Button>
              </div>
            </div>

            {selectedBike && (
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-white">
                  <Bike size={20} />
                </span>
                <div>
                  <p className="font-medium text-slate-900">{selectedBike.cycle_code}</p>
                  <p className="text-xs text-slate-500">
                    {selectedBike.station_name || 'Currently out on a ride'} ·{' '}
                    {selectedBike.status.toLowerCase().replace('_', ' ')}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <Field label="What is the problem?" htmlFor="category" error={errors.category} required>
              <Select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                invalid={!!errors.category}
              >
                <option value="">Select a category…</option>
                {MAINTENANCE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="How bad is it?"
              htmlFor="severity"
              hint="High and critical issues take the cycle out of service until a mechanic clears it."
            >
              <Select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {MAINTENANCE_SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Describe what happened"
              htmlFor="description"
              error={errors.description}
              required
              hint={`${description.length} / ${DESCRIPTION_MAX} characters`}
            >
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={DESCRIPTION_MAX}
                placeholder="e.g. The rear brake lever goes all the way to the grip and barely slows the cycle."
                className={
                  'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset ' +
                  (errors.description
                    ? 'ring-rose-400 focus:ring-rose-500'
                    : 'ring-slate-300 focus:ring-brand-600')
                }
              />
            </Field>

            {isSafetyIssue && (
              <div
                className="flex items-start gap-2.5 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800"
                role="status"
              >
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                <p>
                  Because you marked this as a safety issue, this cycle will be taken out of
                  service for inspection — immediately if it is parked, or as soon as the current
                  ride ends.
                </p>
              </div>
            )}
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/app')}>
              Cancel
            </Button>
            <Button type="submit">
              <Wrench size={16} /> Submit report
            </Button>
          </div>
        </form>
      </DataState>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submitReport}
        loading={saving}
        tone={isSafetyIssue ? 'danger' : 'primary'}
        title="Submit this report?"
        confirmLabel="Submit report"
        message={
          isSafetyIssue
            ? `${selectedBike?.cycle_code} will be taken out of service for inspection. Only submit a safety issue if the cycle is genuinely unsafe to ride.`
            : `Your report about ${selectedBike?.cycle_code} will be sent to the maintenance team.`
        }
      />
    </div>
  );
}
