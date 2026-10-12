import Card from '../ui/Card';
import Spinner from '../ui/Spinner';

/**
 * Frame for a chart: title, optional note about what the figures cover, and
 * the empty/loading states a chart needs so an empty database never renders
 * an unlabelled blank box.
 */
export default function ChartCard({
  title,
  note,
  loading = false,
  isEmpty = false,
  emptyMessage = 'No data for this period yet.',
  height = 260,
  actions,
  children,
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
        </div>
        {actions}
      </div>

      {loading ? (
        <div className="grid place-items-center text-slate-300" style={{ height }} role="status">
          <Spinner size={22} />
          <span className="sr-only">Loading chart…</span>
        </div>
      ) : isEmpty ? (
        <div
          className="grid place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center text-sm text-slate-500"
          style={{ height }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </Card>
  );
}
