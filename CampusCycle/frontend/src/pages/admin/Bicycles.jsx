import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, Plus, Search, Pencil, Trash2, Wrench, CircleCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Input, Select } from '../../components/ui/Field';
import BicycleFormModal from '../../components/admin/BicycleFormModal';
import { bicyclesApi, stationsApi } from '../../services';
import { useToast } from '../../context/ToastContext';

const STATUS_FILTERS = ['ALL', 'AVAILABLE', 'IN_USE', 'RESERVED', 'MAINTENANCE'];

export default function AdminBicycles() {
  const toast = useToast();
  const [bikes, setBikes] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter === 'ALL' ? {} : { status: statusFilter };
      const [bikeList, stationList] = await Promise.all([
        bicyclesApi.list(params),
        stationsApi.list(),
      ]);
      setBikes(bikeList);
      setStations(stationList);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bikes;
    return bikes.filter(
      (b) =>
        b.cycle_code?.toLowerCase().includes(q) ||
        b.qr_code?.toLowerCase().includes(q) ||
        b.station_name?.toLowerCase().includes(q)
    );
  }, [bikes, search]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(bike) {
    setEditing(bike);
    setFormOpen(true);
  }

  async function quickStatus(bike, status) {
    setBusyId(bike.id);
    try {
      // For MAINTENANCE keep the current station; for AVAILABLE it must have one.
      await bicyclesApi.changeStatus(bike.id, status, bike.station_id ?? undefined);
      toast.success(`${bike.cycle_code} → ${status === 'MAINTENANCE' ? 'maintenance' : 'available'}.`);
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
      await bicyclesApi.remove(deleting.id);
      toast.success(`${deleting.cycle_code} removed.`);
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
        title="Bicycles"
        subtitle="Manage the campus cycle fleet."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add bicycle
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, QR or station"
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-24 text-slate-400">
          <Spinner size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="No bicycles found"
          description="Adjust your filters or add a new bicycle to the fleet."
          action={
            <Button onClick={openCreate}>
              <Plus size={16} /> Add bicycle
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Cycle code</Th>
              <Th>QR code</Th>
              <Th>Station</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {filtered.map((bike) => {
              const onRide = bike.status === 'IN_USE';
              const busy = busyId === bike.id;
              return (
                <Tr key={bike.id}>
                  <Td>
                    <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                      <Bike size={15} className="text-slate-400" />
                      {bike.cycle_code}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs text-slate-500">{bike.qr_code}</Td>
                  <Td className="text-slate-600">{bike.station_name || <span className="text-slate-300">—</span>}</Td>
                  <Td>
                    <StatusBadge kind="bicycle" status={bike.status} />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {onRide ? (
                        <span className="text-xs text-slate-400">On active ride</span>
                      ) : (
                        <>
                          {bike.status === 'MAINTENANCE' ? (
                            <button
                              onClick={() => quickStatus(bike, 'AVAILABLE')}
                              disabled={busy}
                              title="Return to service"
                              className="rounded-md p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                            >
                              {busy ? <Spinner size={15} /> : <CircleCheck size={15} />}
                            </button>
                          ) : (
                            <button
                              onClick={() => quickStatus(bike, 'MAINTENANCE')}
                              disabled={busy}
                              title="Send to maintenance"
                              className="rounded-md p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                            >
                              {busy ? <Spinner size={15} /> : <Wrench size={15} />}
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(bike)}
                            title="Edit"
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleting(bike)}
                            title="Delete"
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <BicycleFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        bicycle={editing}
        stations={stations}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="Delete bicycle"
        message={`Remove ${deleting?.cycle_code} from the fleet? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
