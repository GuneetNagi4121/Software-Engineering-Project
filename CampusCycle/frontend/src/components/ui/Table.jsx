import { cn } from '../../utils/format';

export function Table({ className, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
      <table className={cn('min-w-full divide-y divide-slate-200 text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }) {
  return <thead className="bg-slate-50/80">{children}</thead>;
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function Tr({ className, children, ...props }) {
  return (
    <tr className={cn('transition hover:bg-slate-50/60', className)} {...props}>
      {children}
    </tr>
  );
}

export function Th({ className, children }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }) {
  return (
    <td className={cn('whitespace-nowrap px-4 py-3 text-slate-700', className)} {...props}>
      {children}
    </td>
  );
}
