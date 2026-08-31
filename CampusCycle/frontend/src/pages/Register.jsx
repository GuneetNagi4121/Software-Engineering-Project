import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import Logo from '../components/ui/Logo';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function update(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/app', { replace: true });
    } catch (err) {
      if (err.details && typeof err.details === 'object') setFieldErrors(err.details);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo className="[&_span]:text-white [&>span>span]:text-white" showText />
        <div>
          <h2 className="text-3xl font-semibold leading-tight">
            Join the campus mobility network.
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            Create a student account to reserve cycles, track your active ride in real time, and
            review your ride history.
          </p>
        </div>
        <p className="text-sm text-white/60">CampusCycle · Mobility Management System</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Sign up as a student to start riding.</p>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="name"
                  value={form.name}
                  onChange={update('name')}
                  placeholder="Aditi Sharma"
                  className="pl-9"
                  invalid={!!fieldErrors.name}
                  required
                />
              </div>
            </Field>

            <Field label="Email" htmlFor="email" error={fieldErrors.email}>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  placeholder="you@campus.edu"
                  className="pl-9"
                  invalid={!!fieldErrors.email}
                  required
                />
              </div>
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              error={fieldErrors.password}
              hint="At least 8 characters, including a letter and a number."
            >
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={update('password')}
                  placeholder="••••••••"
                  className="pl-9"
                  invalid={!!fieldErrors.password}
                  required
                />
              </div>
            </Field>

            <Button type="submit" className="w-full" loading={submitting}>
              Create account <ArrowRight size={16} />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
