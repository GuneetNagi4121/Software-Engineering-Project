import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Bike,
  Map as MapIcon,
  MapPin,
  History,
  Wrench,
  ClipboardList,
  User,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import Logo from '../components/ui/Logo';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/format';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/find', label: 'Find a Bicycle', icon: Bike },
  { to: '/app/map', label: 'Campus Map', icon: MapIcon },
  { to: '/app/stations', label: 'Stations', icon: MapPin },
  { to: '/app/rides', label: 'My Rides', icon: History },
  { to: '/app/report', label: 'Report an Issue', icon: Wrench, primary: false },
  { to: '/app/reports', label: 'My Reports', icon: ClipboardList, primary: false },
  { to: '/app/profile', label: 'Profile', icon: User },
];

function navClass({ isActive }) {
  return cn(
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  );
}

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />

          {/* The desktop bar shows the primary destinations; the mobile menu
              and the "More" row below carry the full set. */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.filter((item) => item.primary !== false).map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                <item.icon size={16} /> {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight text-slate-900">{user?.name}</p>
              <p className="text-xs leading-tight text-slate-400">Student</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>

          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-100 px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navClass}
                  onClick={() => setMenuOpen(false)}
                >
                  <item.icon size={16} /> {item.label}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="mt-1 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut size={16} /> Sign out
              </button>
            </nav>
          </div>
        )}
      </header>

      <div className="hidden border-b border-slate-100 bg-white lg:block">
        <nav
          className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-1.5 sm:px-6"
          aria-label="Maintenance"
        >
          {NAV.filter((item) => item.primary === false).map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              <item.icon size={15} /> {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
