import { Bike } from 'lucide-react';
import { cn } from '../../utils/format';

export default function Logo({ className, showText = true, size = 'md' }) {
  const dim = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  const box = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('grid place-items-center rounded-lg bg-brand-600 text-white', box)}>
        <Bike size={dim} />
      </span>
      {showText && (
        <span className="text-base font-semibold tracking-tight text-slate-900">
          Campus<span className="text-brand-600">Cycle</span>
        </span>
      )}
    </span>
  );
}
