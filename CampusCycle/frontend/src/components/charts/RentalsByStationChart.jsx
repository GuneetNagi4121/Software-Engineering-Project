import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartCard from './ChartCard';
import { PRIMARY, GRID, AXIS_TEXT, TOOLTIP_STYLE } from './palette';

/**
 * Trips per station — one series, so no legend: the title names it.
 * Horizontal bars because station names are words, not a time axis.
 */
export default function RentalsByStationChart({ data = [], loading }) {
  const rows = data.map((s) => ({
    name: s.name,
    trips: s.total_trips,
    started: s.started_here,
    ended: s.ended_here,
  }));
  const hasData = rows.some((r) => r.trips > 0);

  return (
    <ChartCard
      title="Trips by station"
      note="A ride counts once for the station it started at and once for where it ended."
      loading={loading}
      isEmpty={!loading && !hasData}
      emptyMessage="No station activity in this period."
      height={Math.max(220, rows.length * 38)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            stroke={GRID}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            stroke={GRID}
            tickLine={false}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, _key, entry) => [
              `${value} trips (${entry.payload.started} started, ${entry.payload.ended} ended)`,
              'Total',
            ]}
          />
          <Bar
            dataKey="trips"
            name="Trips"
            fill={PRIMARY}
            radius={[0, 4, 4, 0]}
            barSize={16}
            label={{ position: 'right', fill: AXIS_TEXT, fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
