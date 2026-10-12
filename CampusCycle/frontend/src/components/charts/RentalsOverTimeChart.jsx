import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import ChartCard from './ChartCard';
import { SERIES, GRID, AXIS_TEXT, TOOLTIP_STYLE } from './palette';

/** "12 Oct" from an ISO date string, without re-parsing in a timezone. */
function shortDay(day) {
  if (!day) return '';
  const [, month, date] = day.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(date)} ${names[Number(month) - 1] || ''}`;
}

export default function RentalsOverTimeChart({ data = [], loading, note }) {
  const hasRides = data.some((d) => d.rides > 0 || d.completed > 0);
  // One label every ~6 days keeps the axis readable on a 30-day range.
  const interval = Math.max(0, Math.ceil(data.length / 6) - 1);

  return (
    <ChartCard
      title="Rides over time"
      note={note || 'Rides counted by the day they started, in the selected range.'}
      loading={loading}
      isEmpty={!loading && !hasRides}
      emptyMessage="No rides were started in this period."
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={shortDay}
            interval={interval}
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
            labelFormatter={(day) => shortDay(day)}
            formatter={(value, name) => [value, name]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }}
          />
          <Line
            type="monotone"
            name="Rides started"
            dataKey="rides"
            stroke={SERIES[0]}
            strokeWidth={2}
            dot={{ r: 0 }}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          />
          {/* Dashed as well as differently coloured, so the two series are
              distinguishable without relying on colour alone. */}
          <Line
            type="monotone"
            name="Completed"
            dataKey="completed"
            stroke={SERIES[1]}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 0 }}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
