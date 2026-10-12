import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartCard from './ChartCard';
import { SEVERITY_COLORS, GRID, AXIS_TEXT, TOOLTIP_STYLE } from './palette';
import { severityLabel } from '../../utils/domain';

/** Reported issues by severity within the selected range. */
export default function MaintenanceSeverityChart({ data = [], loading }) {
  const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const rows = [...data]
    .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
    .map((d) => ({ severity: d.severity, label: severityLabel(d.severity), count: d.count }));
  const hasData = rows.some((r) => r.count > 0);

  return (
    <ChartCard
      title="Reported issues by severity"
      note="Maintenance reports filed in the selected range."
      loading={loading}
      isEmpty={!loading && !hasData}
      emptyMessage="No issues were reported in this period."
      height={240}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
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
          <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [`${value} reports`, 'Count']} />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            barSize={44}
            label={{ position: 'top', fill: AXIS_TEXT, fontSize: 11 }}
          >
            {rows.map((row) => (
              <Cell key={row.severity} fill={SEVERITY_COLORS[row.severity] || AXIS_TEXT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
