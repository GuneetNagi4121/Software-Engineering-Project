import { useEffect, useState } from 'react';
import { Bike, ChevronLeft, MapPin, Search } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';
import { Input } from './ui/Field';
import QrPanel from './QrPanel';
import { bicyclesApi, rentalsApi } from '../services';
import { useToast } from '../context/ToastContext';
import { cn } from '../utils/format';

/**
 * Guided rental flow. Either start from a preselected bike (jump straight to
 * confirm) or let the student pick an available cycle first.
 */
export default function RentDialog({ open, onClose, onRented, preselectedBike = null }) {
  const toast = useToast();
  const [step, setStep] = useState('select'); // 'select' | 'confirm'
  const [bikes, setBikes] = useState([]);
  const [loadingBikes, setLoadingBikes] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [qr, setQr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (preselectedBike) {
      setSelected(preselectedBike);
      setQr(preselectedBike.qr_code || '');
      setStep('confirm');
    } else {
      setSelected(null);
      setQr('');
      setStep('select');
      loadBikes();
    }
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadBikes() {
    setLoadingBikes(true);
    try {
      const list = await bicyclesApi.list({ status: 'AVAILABLE' });
      setBikes(list);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingBikes(false);
    }
  }

  function pick(bike) {
    setSelected(bike);
    setQr(bike.qr_code || '');
    setStep('confirm');
  }

  async function confirm() {
    const code = qr.trim();
    if (!code) {
      toast.error('Enter or scan a cycle QR code first.');
      return;
    }
    setSubmitting(true);
    try {
      const rental = await rentalsApi.start(code);
      toast.success(`Ride started on ${rental.bicycle_code}. Enjoy the ride!`);
      onRented?.(rental);
      onClose?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = bikes.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.cycle_code?.toLowerCase().includes(q) ||
      b.qr_code?.toLowerCase().includes(q) ||
      b.station_name?.toLowerCase().includes(q)
    );
  });

  const title = step === 'select' ? 'Find a cycle' : 'Confirm your ride';

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={title}
      description={
        step === 'select'
          ? 'Pick an available cycle to rent.'
          : 'Scan or enter the QR code on the cycle to unlock it.'
      }
      footer={
        step === 'confirm' ? (
          <>
            {!preselectedBike && (
              <Button variant="ghost" onClick={() => setStep('select')} disabled={submitting}>
                <ChevronLeft size={16} /> Back
              </Button>
            )}
            <Button onClick={confirm} loading={submitting}>
              Confirm &amp; start ride
            </Button>
          </>
        ) : null
      }
    >
      {step === 'select' ? (
        <div>
          <div className="mb-3">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code or station"
                className="pl-9"
              />
            </div>
          </div>

          {loadingBikes ? (
            <div className="grid place-items-center py-10 text-slate-400">
              <Spinner size={24} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bike}
              title="No cycles available"
              description="There are no available cycles right now. Please check back shortly."
            />
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {filtered.map((bike) => (
                <li key={bike.id}>
                  <button
                    type="button"
                    onClick={() => pick(bike)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                        <Bike size={18} />
                      </span>
                      <span>
                        <span className="block font-medium text-slate-900">{bike.cycle_code}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin size={12} /> {bike.station_name || 'Unassigned'}
                        </span>
                      </span>
                    </span>
                    <span className="font-mono text-xs text-slate-400">{bike.qr_code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {selected && (
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-white">
                <Bike size={20} />
              </span>
              <div>
                <p className="font-medium text-slate-900">{selected.cycle_code}</p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin size={12} /> {selected.station_name || 'Unassigned'}
                </p>
              </div>
            </div>
          )}
          <QrPanel value={qr} onChange={setQr} disabled={submitting} />
        </div>
      )}
    </Modal>
  );
}
