import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { stationsApi } from '../../services';
import { useToast } from '../../context/ToastContext';

const empty = { name: '', location: '', capacity: 10, status: 'ACTIVE', latitude: '', longitude: '' };

export default function StationFormModal({ open, onClose, onSaved, station }) {
  const toast = useToast();
  const isEdit = !!station;
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      station
        ? {
            name: station.name || '',
            location: station.location || '',
            capacity: station.capacity ?? 10,
            status: station.status || 'ACTIVE',
            latitude: station.latitude ?? '',
            longitude: station.longitude ?? '',
          }
        : empty
    );
  }, [open, station]);

  function update(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErrors({});
    const payload = {
      name: form.name.trim(),
      location: form.location.trim(),
      capacity: Number(form.capacity),
      status: form.status,
      // Coordinates are optional, but must be sent as a pair. An empty string
      // clears them, which is how a station is taken off the map.
      latitude: form.latitude === '' ? '' : Number(form.latitude),
      longitude: form.longitude === '' ? '' : Number(form.longitude),
    };
    setSaving(true);
    try {
      if (isEdit) {
        await stationsApi.update(station.id, payload);
        toast.success(`${payload.name} updated.`);
      } else {
        await stationsApi.create(payload);
        toast.success(`${payload.name} created.`);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={isEdit ? 'Edit station' : 'Add station'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="station-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Add station'}
          </Button>
        </>
      }
    >
      <form id="station-form" className="space-y-4" onSubmit={onSubmit}>
        <Field label="Station name" htmlFor="name" error={errors.name} required>
          <Input
            id="name"
            value={form.name}
            onChange={update('name')}
            placeholder="Central Library"
            invalid={!!errors.name}
            required
          />
        </Field>

        <Field label="Location" htmlFor="location" error={errors.location} required>
          <Input
            id="location"
            value={form.location}
            onChange={update('location')}
            placeholder="North Campus, Block A"
            invalid={!!errors.location}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Capacity" htmlFor="capacity" error={errors.capacity} required>
            <Input
              id="capacity"
              type="number"
              min={1}
              max={1000}
              value={form.capacity}
              onChange={update('capacity')}
              invalid={!!errors.capacity}
              required
            />
          </Field>

          <Field label="Status" htmlFor="status" error={errors.status}>
            <Select id="status" value={form.status} onChange={update('status')}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
        </div>

        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-medium text-slate-600">
            Map position (optional)
          </legend>
          <p className="mb-3 text-xs text-slate-500">
            Fill both to place this station on the campus map, or leave both empty to keep it off
            the map. Decimal degrees, e.g. 30.356800 / 76.362800.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="latitude" error={errors.latitude}>
              <Input
                id="latitude"
                value={form.latitude}
                onChange={update('latitude')}
                inputMode="decimal"
                placeholder="30.356800"
                className="font-mono"
                invalid={!!errors.latitude}
              />
            </Field>
            <Field label="Longitude" htmlFor="longitude" error={errors.longitude}>
              <Input
                id="longitude"
                value={form.longitude}
                onChange={update('longitude')}
                inputMode="decimal"
                placeholder="76.362800"
                className="font-mono"
                invalid={!!errors.longitude}
              />
            </Field>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
