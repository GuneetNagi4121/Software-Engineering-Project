import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus, Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import StationFormModal from '../../components/admin/StationFormModal';
import { stationsApi } from '../../services';
import { useToast } from '../../context/ToastContext';

export default function AdminStations() {
  const toast = useToast();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStations(await stationsApi.list());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(station) {
    setEditing(station);
    setFormOpen(true);
  }

  async function toggleStatus(station) {
    const next = station.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setBusyId(station.id);
    try {
      await stationsApi.setStatus(station.id, next);
      toast.success(`${station.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    setDeleteLoading(true);
    try {
      await stationsApi.remove(deleting.id);
      toast.success(`${deleting.name} deleted.`);
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Stations"
        subtitle="Manage docking stations and capacity."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add station
          </Button>
        }
      />

      {loading ? (
        <div className="grid place-items-center py-24 text-slate-400">
          <Spinner size={28} />
        </div>
      ) : stations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No stations yet"
          description="Add your first docking station to get started."
          action={
            <Button onClick={openCreate}>
              <Plus size={16} /> Add station
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Station</Th>
              <Th>Location</Th>
              <Th>Availability</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {stations.map((s) => {
              const busy = busyId === s.id;
              const active = s.status === 'ACTIVE';
              return (
                <Tr key={s.id}>
                  <Td className="font-medium text-slate-900">{s.name}</Td>
                  <Td className="text-slate-600">{s.location}</Td>
                  <Td className="tabular-nums text-slate-600">
                    {s.available_count} / {s.capacity}
                  </Td>
                  <Td>
                    <StatusBadge kind="station" status={s.status} />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleStatus(s)}
                        disabled={busy}
                        title={active ? 'Deactivate' : 'Activate'}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      >
                        {busy ? (
                          <Spinner size={15} />
                        ) : active ? (
                          <PowerOff size={15} />
                        ) : (
                          <Power size={15} />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        title="Edit"
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleting(s)}
                        title="Delete"
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <StationFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        station={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="Delete station"
        message={`Delete ${deleting?.name}? Stations with assigned cycles or active rides cannot be deleted.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
