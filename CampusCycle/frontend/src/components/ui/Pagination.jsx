import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

/**
 * Offset/limit pager driven by the backend's `pagination` object
 * ({ limit, offset, total }). Rendered only when there is more than one page.
 */
export default function Pagination({ pagination, onChange, loading }) {
  if (!pagination) return null;
  const { limit = 25, offset = 0, total = 0 } = pagination;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(offset / limit) + 1;
  if (total === 0) return null;

  const first = offset + 1;
  const last = Math.min(offset + limit, total);

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-slate-500" role="status">
        Showing <span className="font-medium text-slate-700">{first}</span>–
        <span className="font-medium text-slate-700">{last}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange(Math.max(0, offset - limit))}
            disabled={loading || page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} /> Previous
          </Button>
          <span className="text-sm tabular-nums text-slate-500">
            Page {page} of {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange(offset + limit)}
            disabled={loading || page >= pages}
            aria-label="Next page"
          >
            Next <ChevronRight size={15} />
          </Button>
        </div>
      )}
    </div>
  );
}
