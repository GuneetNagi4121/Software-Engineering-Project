import { Link } from 'react-router-dom';
import { Bike, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  const home = user ? (user.role === 'ADMIN' ? '/admin' : '/app') : '/login';

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white">
          <Bike size={28} />
        </span>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-6">
          <Button as={Link} to={home}>
            <ArrowLeft size={16} /> Back to safety
          </Button>
        </div>
      </div>
    </div>
  );
}
