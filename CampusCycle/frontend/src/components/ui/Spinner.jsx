import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/format';

export default function Spinner({ size = 16, className }) {
  return <Loader2 size={size} className={cn('animate-spin', className)} />;
}
