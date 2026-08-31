import { useState } from 'react';
import { User, Mail, ShieldCheck, Save } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services';
import { useToast } from '../../context/ToastContext';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const dirty = name.trim() !== (user?.name || '') && name.trim().length > 0;

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authApi.updateProfile(name.trim());
      setUser(updated);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" subtitle="Manage your account details." />

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
            {initials}
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-900">{user?.name}</p>
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <Mail size={14} /> {user?.email}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              <ShieldCheck size={12} /> {user?.role === 'ADMIN' ? 'Administrator' : 'Student'}
            </span>
          </div>
        </div>

        <hr className="my-6 border-slate-100" />

        <form className="space-y-4" onSubmit={onSave}>
          <Field label="Full name" htmlFor="name">
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </Field>

          <Field label="Email" htmlFor="email" hint="Email cannot be changed in this phase.">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input id="email" value={user?.email || ''} className="pl-9" disabled />
            </div>
          </Field>

          <div className="flex justify-end">
            <Button type="submit" loading={saving} disabled={!dirty}>
              <Save size={16} /> Save changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
