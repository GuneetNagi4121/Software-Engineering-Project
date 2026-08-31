import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { Field, Select } from './ui/Field';
import { stationsApi, rentalsApi } from '../services';
import { useToast } from '../context/ToastContext';

/**
 * Return flow: choose a destination station, then complete the rental.
 * Used by both students (their own ride) and admins (force-return any ride).
 */
export default function ReturnDialog({ open, onClose, onReturned, rental }) {
  const toast = useToast();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stationId, setStationId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStationId('');
    (async () => {
      setLoading(true);
      try {
        const list = await stationsApi.list();
        setStations(list.filter((s) => s.status === 'ACTIVE'));
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function confirm() {
    if (!stationId) {
      toast.error('Please choose a station to return the cycle to.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await rentalsApi.returnRide(rental.id, Number(stationId));
      toast.success('Ride ended. Thanks for riding with CampusCycle!');
      onReturned?.(updated);
      onClose?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="End your ride"
      description={rental ? `Returning ${rental.bicycle_code}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={confirm} loading={submitting} disabled={loading}>
            End ride here
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="grid place-items-center py-8 text-slate-400">
          <Spinner size={22} />
        </div>
      ) : (
        <Field label="Return station" htmlFor="return-station" required>
          <Select
            id="return-station"
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
          >
            <option value="">Select a station…</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.location} ({s.available_count}/{s.capacity} free)
              </option>
            ))}
          </Select>
        </Field>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-400">
        <MapPin size={13} className="mt-0.5 shrink-0" />
        Park the cycle at the chosen station&apos;s dock before ending the ride.
      </p>
    </Modal>
  );
}
