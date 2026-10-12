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

function hourLabel(hour) {
  const h = Number(hour);
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

/** Rides by hour of the day, in the server's reporting timezone. */
export default function UsageByHourChart({ data = [], loading, timezoneNote }) {
  const hasData = data.some((d) => d.rides > 0);

  return (
    <ChartCard
      title="Busiest hours"
      note={timezoneNote || 'Rides grouped by the hour they started, in the selected range.'}
      loading={loading}
      isEmpty={!loading && !hasData}
      emptyMessage="No rides were started in this period."
      height={240}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={hourLabel}
            interval={2}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            stroke={GRID}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            stroke={GRID}
            tickLine={false}
            width={44}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            labelFormatter={(hour) => `${String(hour).padStart(2, '0')}:00`}
            formatter={(value) => [`${value} rides`, 'Started']}
          />
          <Bar dataKey="rides" fill={PRIMARY} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
