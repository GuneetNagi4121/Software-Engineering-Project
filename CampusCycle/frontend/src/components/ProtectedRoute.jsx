import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './ui/Spinner';

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50">
      <Spinner size={28} className="text-brand-600" />
    </div>
  );
}

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    // Signed in but wrong area — send to the user's own home.
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/app'} replace />;
  }

  return children;
}
