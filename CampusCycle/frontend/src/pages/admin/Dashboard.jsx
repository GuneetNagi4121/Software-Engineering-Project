import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, CheckCircle2, Wrench, Route, Building2, ArrowRight, Activity } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { adminApi } from '../../services';
import { useToast } from '../../context/ToastContext';
import { formatDateTime } from '../../utils/format';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminApi.overview());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="grid place-items-center py-24 text-slate-400">
        <Spinner size={28} />
      </div>
    );
  }

  const b = data.bicycles;

  return (
    <div>
      <PageHeader
        title="Campus overview"
        subtitle="Live snapshot of fleet, stations and rides."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total cycles" value={b.TOTAL} icon={Bike} tone="slate" />
        <StatCard label="Available" value={b.AVAILABLE} icon={CheckCircle2} tone="emerald" />
        <StatCard label="In use" value={b.IN_USE} icon={Activity} tone="blue" />
        <StatCard label="Maintenance" value={b.MAINTENANCE} icon={Wrench} tone="amber" />
        <StatCard label="Stations" value={data.stations.total} icon={Building2} tone="violet" hint={`${data.stations.active} active`} />
        <StatCard label="Active rides" value={data.activeRentals} icon={Route} tone="blue" />
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-900">Recent rentals</h3>
          <button
            onClick={() => navigate('/admin/rentals')}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View all <ArrowRight size={14} />
          </button>
        </div>

        {data.recentRentals.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Route} title="No rentals yet" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <THead>
                <Tr>
                  <Th>Student</Th>
                  <Th>Cycle</Th>
                  <Th>Route</Th>
                  <Th>Started</Th>
                  <Th>Status</Th>
                </Tr>
              </THead>
              <TBody>
                {data.recentRentals.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium text-slate-900">{r.user_name}</Td>
                    <Td>{r.bicycle_code}</Td>
                    <Td className="text-slate-600">
                      {r.start_station_name || '—'}
                      {r.end_station_name ? ` → ${r.end_station_name}` : ''}
                    </Td>
                    <Td className="text-slate-600">{formatDateTime(r.started_at)}</Td>
                    <Td>
                      <StatusBadge kind="rental" status={r.status} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
