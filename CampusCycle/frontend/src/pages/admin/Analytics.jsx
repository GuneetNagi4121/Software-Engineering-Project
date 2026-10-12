import { useCallback, useEffect, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  Activity,
  Wrench,
  Building2,
  Route as RouteIcon,
  Timer,
  Users,
  RefreshCw,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import DataState from '../../components/ui/DataState';
import { Input, Select } from '../../components/ui/Field';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import RentalsOverTimeChart from '../../components/charts/RentalsOverTimeChart';
import RentalsByStationChart from '../../components/charts/RentalsByStationChart';
import BicycleStatusChart from '../../components/charts/BicycleStatusChart';
import UsageByHourChart from '../../components/charts/UsageByHourChart';
import MaintenanceSeverityChart from '../../components/charts/MaintenanceSeverityChart';
import { analyticsApi } from '../../services';
import { formatMinutes, formatSeconds, todayInputValue } from '../../utils/format';

const PRESETS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

/**
 * Admin usage analytics.
 *
 * Every figure on this page comes from GET /api/analytics, which aggregates
 * the live PostgreSQL tables. The page keeps two groups apart on purpose:
 * "Right now / all time" is a snapshot that the date filter does not touch,
 * and "Selected period" only counts rides that started inside the range.
 */
export default function AdminAnalytics() {
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState(todayInputValue(-29));
  const [to, setTo] = useState(todayInputValue());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await analyticsApi.overview({ from, to }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function applyPreset(value) {
    setPreset(value);
    if (value === 'custom') return;
    const days = Number(value);
    setFrom(todayInputValue(-(days - 1)));
    setTo(todayInputValue());
  }

  const lifetime = data?.lifetime;
  const period = data?.period;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Fleet and ridership figures, aggregated from the live database."
        actions={
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </Button>
        }
      />

      {/* Filters sit in one row above the charts. */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-44">
            <label htmlFor="preset" className="mb-1 block text-xs font-medium text-slate-600">
              Date range
            </label>
            <Select id="preset" value={preset} onChange={(e) => applyPreset(e.target.value)}>
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:w-44">
            <label htmlFor="from" className="mb-1 block text-xs font-medium text-slate-600">
              From
            </label>
            <Input
              id="from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset('custom');
              }}
            />
          </div>
          <div className="sm:w-44">
            <label htmlFor="to" className="mb-1 block text-xs font-medium text-slate-600">
              To
            </label>
            <Input
              id="to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset('custom');
              }}
            />
          </div>
          {data && (
            <p className="text-xs text-slate-500 sm:ml-auto sm:pb-2">
              {data.range.days} day(s) selected
            </p>
          )}
        </div>
      </Card>

      <DataState loading={loading && !data} error={error} onRetry={load}>
        {data && (
          <div className="space-y-8">
            {/* --- snapshot / lifetime ------------------------------------- */}
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Right now, and all time</h2>
              <p className="mb-3 text-xs text-slate-500">
                A snapshot of the fleet plus all-time totals. These figures are not affected by the
                date range above.
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Total cycles" value={lifetime.total_bicycles} icon={Bike} tone="slate" />
                <StatCard
                  label="Available"
                  value={lifetime.available_bicycles}
                  icon={CheckCircle2}
                  tone="emerald"
                />
                <StatCard label="In use" value={lifetime.in_use_bicycles} icon={Activity} tone="blue" />
                <StatCard
                  label="Maintenance"
                  value={lifetime.maintenance_bicycles}
                  icon={Wrench}
                  tone="amber"
                />
                <StatCard
                  label="Stations"
                  value={lifetime.total_stations}
                  icon={Building2}
                  tone="violet"
                  hint={`${lifetime.active_stations} active · ${lifetime.mapped_stations} mapped`}
                />
                <StatCard
                  label="Active rides"
                  value={lifetime.active_rentals}
                  icon={RouteIcon}
                  tone="blue"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard
                  label="Completed today"
                  value={lifetime.completed_today}
                  icon={CheckCircle2}
                  tone="emerald"
                />
                <StatCard
                  label="Completed rides"
                  value={lifetime.completed_rentals}
                  icon={RouteIcon}
                  tone="slate"
                  hint="All time"
                />
                <StatCard
                  label="Average ride"
                  value={formatMinutes(lifetime.avg_completed_minutes)}
                  icon={Timer}
                  tone="violet"
                  hint="All completed rides"
                />
                <StatCard
                  label="Fleet in use"
                  value={`${lifetime.fleet_utilisation_pct}%`}
                  icon={Activity}
                  tone="blue"
                />
                <StatCard
                  label="Docks filled"
                  value={`${lifetime.network_availability_pct}%`}
                  icon={Bike}
                  tone="emerald"
                  hint={`${lifetime.total_available_at_stations} of ${lifetime.total_capacity} docks filled`}
                />
              </div>
            </section>

            {/* --- selected period ---------------------------------------- */}
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Selected period</h2>
              <p className="mb-3 text-xs text-slate-500">
                Rides that started between {from} and {to}.
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Rides started" value={period.rides_started} icon={RouteIcon} tone="blue" />
                <StatCard
                  label="Rides completed"
                  value={period.rides_completed}
                  icon={CheckCircle2}
                  tone="emerald"
                />
                <StatCard label="Still active" value={period.rides_active} icon={Activity} tone="amber" />
                <StatCard label="Unique riders" value={period.unique_riders} icon={Users} tone="violet" />
                <StatCard
                  label="Average ride"
                  value={formatMinutes(period.avg_completed_minutes)}
                  icon={Timer}
                  tone="slate"
                />
                <StatCard
                  label="Rides per day"
                  value={period.rides_per_day}
                  icon={Activity}
                  tone="blue"
                />
              </div>
            </section>

            {/* --- charts -------------------------------------------------- */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Trends</h2>

              <RentalsOverTimeChart data={data.charts.rentalsOverTime} loading={loading} />

              <div className="grid items-start gap-4 lg:grid-cols-2">
                <RentalsByStationChart data={data.charts.rentalsByStation} loading={loading} />
                <BicycleStatusChart data={data.charts.bicycleStatus} loading={loading} />
                <UsageByHourChart data={data.charts.usageByHour} loading={loading} />
                <MaintenanceSeverityChart
                  data={data.charts.maintenanceBySeverity}
                  loading={loading}
                />
              <Card className="p-4 sm:p-5">
                <h3 className="mb-1 text-sm font-semibold text-slate-900">Most-used stations</h3>
                <p className="mb-3 text-xs text-slate-500">Within the selected period.</p>
                {data.leaderboards.topStations.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
                    No station activity in this period.
                  </p>
                ) : (
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Station</Th>
                        <Th>Started</Th>
                        <Th>Ended</Th>
                        <Th>Total</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {data.leaderboards.topStations.map((s) => (
                        <Tr key={s.id}>
                          <Td className="font-medium text-slate-900">{s.name}</Td>
                          <Td className="tabular-nums text-slate-600">{s.started_here}</Td>
                          <Td className="tabular-nums text-slate-600">{s.ended_here}</Td>
                          <Td className="tabular-nums font-medium text-slate-900">
                            {s.total_trips}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Card>
              </div>

              <Card className="p-4 sm:p-5">
                <h3 className="mb-1 text-sm font-semibold text-slate-900">Most-rented cycles</h3>
                <p className="mb-3 text-xs text-slate-500">Within the selected period.</p>
                {data.leaderboards.topBicycles.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
                    No cycles were rented in this period.
                  </p>
                ) : (
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Cycle</Th>
                        <Th>Rides</Th>
                        <Th>Average ride</Th>
                        <Th>Current status</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {data.leaderboards.topBicycles.map((b) => (
                        <Tr key={b.id}>
                          <Td className="font-medium text-slate-900">{b.cycle_code}</Td>
                          <Td className="tabular-nums text-slate-600">{b.rides}</Td>
                          <Td className="tabular-nums text-slate-600">
                            {b.avg_seconds === null ? '—' : formatSeconds(b.avg_seconds)}
                          </Td>
                          <Td className="text-slate-600">
                            {b.status.toLowerCase().replace('_', ' ')}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Card>
            </section>

            <p className="text-xs text-slate-400">
              Generated {new Date(data.generated_at).toLocaleString()} · all figures aggregated from
              PostgreSQL
            </p>
          </div>
        )}
      </DataState>
    </div>
  );
}
