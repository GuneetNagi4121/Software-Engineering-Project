import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { stationsApi } from '../../services';
import { useToast } from '../../context/ToastContext';

const empty = { name: '', location: '', capacity: 10, status: 'ACTIVE' };

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
      </form>
    </Modal>
  );
}
