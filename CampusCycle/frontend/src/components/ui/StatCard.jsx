import Card from './Card';
import { cn } from '../../utils/format';

const ICON_TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-500',
};

export default function StatCard({ label, value, icon: Icon, tone = 'slate', hint, loading }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-500">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-12 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
          )}
        </div>
        {Icon && (
          <div className={cn('shrink-0 rounded-lg p-2', ICON_TONES[tone])}>
            <Icon size={20} />
          </div>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}
