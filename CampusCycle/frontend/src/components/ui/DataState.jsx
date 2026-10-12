import { AlertTriangle } from 'lucide-react';
import Spinner from './Spinner';
import Button from './Button';
import EmptyState from './EmptyState';

/**
 * One place for the three states every data-backed screen needs: loading,
 * failed (with a retry) and empty. Children render only when there is data.
 */
export default function DataState({
  loading,
  error,
  onRetry,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
  minHeight = 'py-20',
}) {
  if (loading) {
    return (
      <div className={`grid place-items-center text-slate-400 ${minHeight}`} role="status">
        <Spinner size={28} />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-rose-100 bg-rose-50/60 px-6 py-10 text-center"
        role="alert"
      >
        <div className="mb-3 rounded-full bg-rose-100 p-3 text-rose-600">
          <AlertTriangle size={22} />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Could not load this data</h3>
        <p className="mt-1 max-w-sm text-sm text-slate-600">{error}</p>
        {onRetry && (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return children;
}
