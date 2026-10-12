import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Spinner from './components/ui/Spinner';

import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

import RideDetail from './pages/RideDetail';

import StudentLayout from './layouts/StudentLayout';
import StudentDashboard from './pages/student/Dashboard';
import StudentStations from './pages/student/Stations';
import StationDetail from './pages/student/StationDetail';
import StudentCampusMap from './pages/student/CampusMap';
import FindCycle from './pages/student/FindCycle';
import MyRides from './pages/student/MyRides';
import ReportIssue from './pages/student/ReportIssue';
import MyReports from './pages/student/MyReports';
import Profile from './pages/student/Profile';

import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminBicycles from './pages/admin/Bicycles';
import AdminStations from './pages/admin/Stations';
import AdminRentals from './pages/admin/Rentals';
import AdminMaintenance from './pages/admin/Maintenance';
import AdminAnalytics from './pages/admin/Analytics';
import AdminCampusMap from './pages/admin/CampusMap';
import AdminGeofenceAlerts from './pages/admin/GeofenceAlerts';

/** Send visitors to the right home based on auth + role. */
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Spinner size={28} className="text-brand-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/app'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Student area */}
      <Route
        path="/app"
        element={
          <ProtectedRoute roles={['STUDENT']}>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="find" element={<FindCycle />} />
        <Route path="map" element={<StudentCampusMap />} />
        <Route path="stations" element={<StudentStations />} />
        <Route path="stations/:id" element={<StationDetail />} />
        <Route path="rides" element={<MyRides />} />
        <Route path="rides/:id" element={<RideDetail />} />
        <Route path="report" element={<ReportIssue />} />
        <Route path="reports" element={<MyReports />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Admin area */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="bicycles" element={<AdminBicycles />} />
        <Route path="stations" element={<AdminStations />} />
        <Route path="rentals" element={<AdminRentals />} />
        <Route path="rentals/:id" element={<RideDetail />} />
        <Route path="maintenance" element={<AdminMaintenance />} />
        <Route path="map" element={<AdminCampusMap />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="geofence" element={<AdminGeofenceAlerts />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
