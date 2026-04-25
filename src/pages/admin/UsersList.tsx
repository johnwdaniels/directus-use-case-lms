import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAdminUser, disableAdminUser, fetchAdminUsers, updateAdminUser } from '@/api/admin';
import { AdminGate } from '@/components/admin/AdminGate';
import type { UnknownRecord } from '@/api/public';

function normalizeCreatedAt(dateInput: string): string | undefined {
  if (!dateInput) return undefined;
  const d = new Date(dateInput);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function UsersList() {
  const qc = useQueryClient();
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<UnknownRecord | null>(null);
  const [form, setForm] = useState<UnknownRecord>({});

  const q = useQuery({
    queryKey: ['admin-users', role, status, createdAt],
    queryFn: () => fetchAdminUsers({ role: role || undefined, status: status || undefined, createdAt: normalizeCreatedAt(createdAt) }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (drawerMode === 'create') return createAdminUser(form);
      if (!editing?.id) throw new Error('Missing user id');
      return updateAdminUser(String(editing.id), form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      setDrawerMode(null);
      setEditing(null);
      setForm({});
    },
  });

  const disableMut = useMutation({
    mutationFn: (id: string) => disableAdminUser(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const rows = (q.data ?? []) as UnknownRecord[];
  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((k) => {
        if (k !== 'password') set.add(k);
      });
    }
    return Array.from(set);
  }, [rows]);

  return (
    <AdminGate>
      <div className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Users</h1>
            <p className="mt-1 text-sm text-slate-600">All `directus_users` fields with quick create/edit/disable flows.</p>
          </div>
          <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => { setDrawerMode('create'); setEditing(null); setForm({ status: 'active' }); }}>
            Create user
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Role ID" value={role} onChange={(e) => setRole(e.target.value)} />
          <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option><option value="active">active</option><option value="inactive">inactive</option><option value="suspended">suspended</option>
          </select>
          <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} />
        </div>

        {q.isLoading ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : null}
        {q.isError ? <p className="mt-6 text-sm text-rose-600">Could not load users.</p> : null}

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50"><tr>{columns.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}<th className="px-3 py-2">actions</th></tr></thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  {columns.map((c) => <td key={c} className="max-w-[220px] truncate px-3 py-2">{typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c] ?? '')}</td>)}
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button className="rounded border px-2 py-1" onClick={() => { setDrawerMode('edit'); setEditing(row); setForm({ ...row }); }}>Edit</button>
                      <button className="rounded border border-rose-200 px-2 py-1 text-rose-700" onClick={() => { if (confirm('Disable this user?')) disableMut.mutate(String(row.id)); }}>Disable</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawerMode ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">{drawerMode === 'create' ? 'Create user' : `Edit ${String(editing?.email ?? editing?.id ?? '')}`}</h2>
            <p className="mt-1 text-xs text-slate-500">Edit a focused subset here; full values remain visible in table view.</p>
            <div className="mt-4 space-y-3">
              {['email', 'first_name', 'last_name', 'role', 'status', 'password'].map((field) => (
                <label key={field} className="block text-sm">
                  <span className="font-medium">{field}</span>
                  <input type={field === 'password' ? 'password' : 'text'} className="mt-1 w-full rounded-lg border px-3 py-2" value={String(form[field] ?? '')} onChange={(e) => setForm((s) => ({ ...s, [field]: e.target.value || null }))} />
                </label>
              ))}
            </div>
            {saveMut.isError ? <p className="mt-3 text-sm text-rose-600">Save failed. Check permissions and field values.</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => setDrawerMode(null)}>Cancel</button>
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminGate>
  );
}
