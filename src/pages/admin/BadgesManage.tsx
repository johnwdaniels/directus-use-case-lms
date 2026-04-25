import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignManualBadgeToUser, createBadge, deleteBadge, fetchAdminBadges, fetchAdminUsers, updateBadge, uploadAdminFile } from '@/api/admin';
import { AdminGate } from '@/components/admin/AdminGate';
import type { UnknownRecord } from '@/api/public';

const CRITERIA_DOCS: Record<string, string> = {
  course_completion: '{"course_id":"uuid"}',
  courses_count: '{"count":5}',
  quiz_perfect_score: '{"quiz_id":"uuid"} or {"count":3}',
  streak: '{"days":7}',
  manual: '{}',
};

export default function BadgesManage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UnknownRecord | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [form, setForm] = useState<UnknownRecord>({
    name: '',
    description: '',
    icon: null,
    color: '#4f46e5',
    criteria_type: 'manual',
    criteria_value: '{}',
  });

  const q = useQuery({ queryKey: ['admin-badges'], queryFn: fetchAdminBadges });
  const usersQ = useQuery({ queryKey: ['admin-users-lite'], queryFn: () => fetchAdminUsers() });

  const saveMut = useMutation({
    mutationFn: async () => {
      try {
        JSON.parse(String(form.criteria_value ?? '{}'));
      } catch {
        throw new Error('Invalid JSON for criteria_value');
      }
      if (editing?.id) return updateBadge(String(editing.id), form);
      return createBadge(form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-badges'] });
      setEditing(null);
      setForm({ name: '', description: '', icon: null, color: '#4f46e5', criteria_type: 'manual', criteria_value: '{}' });
    },
  });
  const delMut = useMutation({ mutationFn: (id: string) => deleteBadge(id), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-badges'] }) });
  const assignMut = useMutation({ mutationFn: (badgeId: string) => assignManualBadgeToUser({ badge: badgeId, user: assignUserId }), onSuccess: () => alert('Badge assigned') });

  async function onUpload(file: File | null) {
    if (!file) return;
    const created = await uploadAdminFile(file);
    setForm((s) => ({ ...s, icon: created.id }));
  }

  return (
    <AdminGate>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Manage badges</h1>
        <p className="mt-1 text-sm text-slate-600">Create, edit, delete, and manually assign manual badges.</p>

        <div className="mt-6 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">{editing ? 'Edit badge' : 'Create badge'}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Name" value={String(form.name ?? '')} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Color (#hex)" value={String(form.color ?? '')} onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))} />
            <textarea className="sm:col-span-2 min-h-[80px] rounded-lg border px-3 py-2 text-sm" placeholder="Description" value={String(form.description ?? '')} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
            <label className="text-sm">Icon file<input type="file" className="mt-1 block text-xs" onChange={(e) => void onUpload(e.target.files?.[0] ?? null)} /></label>
            <select className="rounded-lg border px-3 py-2 text-sm" value={String(form.criteria_type ?? 'manual')} onChange={(e) => setForm((s) => ({ ...s, criteria_type: e.target.value }))}>
              {Object.keys(CRITERIA_DOCS).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">criteria_value (JSON)</label>
              <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => setDocsOpen((v) => !v)}>Docs</button>
            </div>
            {docsOpen ? <pre className="mb-2 rounded-lg bg-slate-50 p-2 text-xs">{Object.entries(CRITERIA_DOCS).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre> : null}
            <textarea className="min-h-[140px] w-full rounded-lg border bg-slate-950 p-3 font-mono text-xs text-emerald-300" value={String(form.criteria_value ?? '{}')} onChange={(e) => setForm((s) => ({ ...s, criteria_value: e.target.value }))} />
          </div>
          {saveMut.isError ? <p className="mt-2 text-sm text-rose-600">{String((saveMut.error as Error)?.message ?? 'Save failed')}</p> : null}
          <div className="mt-3 flex gap-2">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => saveMut.mutate()}>{editing ? 'Save badge' : 'Create badge'}</button>
            {editing ? <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => { setEditing(null); setForm({ name: '', description: '', icon: null, color: '#4f46e5', criteria_type: 'manual', criteria_value: '{}' }); }}>Cancel</button> : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {((q.data ?? []) as UnknownRecord[]).map((badge) => (
            <article key={String(badge.id)} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">{String(badge.name ?? '')}</h3>
              <p className="mt-1 text-sm text-slate-600">{String(badge.description ?? '')}</p>
              <p className="mt-2 text-xs text-slate-500">{String(badge.criteria_type ?? '')}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                <button className="rounded border px-2 py-1 text-xs" onClick={() => { setEditing(badge); setForm({ ...badge, criteria_value: typeof badge.criteria_value === 'string' ? badge.criteria_value : JSON.stringify(badge.criteria_value ?? {}, null, 2) }); }}>Edit</button>
                <button className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => { if (confirm('Delete badge?')) delMut.mutate(String(badge.id)); }}>Delete</button>
                {String(badge.criteria_type ?? '') === 'manual' ? <button className="rounded border px-2 py-1 text-xs" onClick={() => assignMut.mutate(String(badge.id))} disabled={!assignUserId}>Assign manually</button> : null}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-xl border bg-white p-4">
          <label className="text-sm font-medium">User for manual assignment</label>
          <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
            <option value="">Select user…</option>
            {((usersQ.data ?? []) as UnknownRecord[]).map((u) => <option key={String(u.id)} value={String(u.id)}>{`${String(u.first_name ?? '')} ${String(u.last_name ?? '')}`.trim() || String(u.email ?? u.id)}</option>)}
          </select>
        </div>
      </div>
    </AdminGate>
  );
}
