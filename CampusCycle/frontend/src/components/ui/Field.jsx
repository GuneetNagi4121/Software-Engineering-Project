import { forwardRef } from 'react';
import { cn } from '../../utils/format';

const base =
  'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

export const Field = ({ label, htmlFor, error, hint, required, children }) => (
  <div>
    {label && (
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="mt-1 text-xs text-rose-600">{error}</p>
    ) : hint ? (
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    ) : null}
  </div>
);

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        base,
        invalid ? 'ring-rose-400 focus:ring-rose-500' : 'ring-slate-300 focus:ring-brand-600',
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        base,
        'pr-8',
        invalid ? 'ring-rose-400 focus:ring-rose-500' : 'ring-slate-300 focus:ring-brand-600',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
