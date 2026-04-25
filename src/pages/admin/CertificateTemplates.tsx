import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCertificateTemplate, fetchCertificateTemplates, updateCertificateTemplate, uploadAdminFile } from '@/api/admin';
import { AdminGate } from '@/components/admin/AdminGate';
import { CertificateRenderer } from '@/components/certificates/CertificateRenderer';
import type { UnknownRecord } from '@/api/public';

const SAMPLE = {
  id: 'preview',
  user: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
  course: { title: 'Sample Course', instructor: { first_name: 'John', last_name: 'Smith' } },
  issued_at: new Date().toISOString(),
  verification_code: 'VERIFY-CODE-1234',
  final_grade: '92',
};

export default function CertificateTemplates() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UnknownRecord | null>(null);
  const [form, setForm] = useState<UnknownRecord>({
    name: '',
    html_template: '',
    background_image: null,
    accent_color: '#4f46e5',
    issuer_name: '',
    issuer_title: '',
    signature_image: null,
    is_default: false,
  });

  const q = useQuery({ queryKey: ['certificate-templates-admin'], queryFn: fetchCertificateTemplates });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (Boolean(form.is_default)) {
        if (!confirm('Setting this template as default will unset the previous default automatically. Continue?')) {
          throw new Error('Cancelled');
        }
      }
      if (editing?.id) return updateCertificateTemplate(String(editing.id), form);
      return createCertificateTemplate(form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['certificate-templates-admin'] });
      setEditing(null);
      setForm({ name: '', html_template: '', background_image: null, accent_color: '#4f46e5', issuer_name: '', issuer_title: '', signature_image: null, is_default: false });
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => updateCertificateTemplate(id, { is_default: true }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['certificate-templates-admin'] }),
  });

  async function upload(field: 'background_image' | 'signature_image', file: File | null) {
    if (!file) return;
    const row = await uploadAdminFile(file);
    setForm((s) => ({ ...s, [field]: row.id }));
  }

  const previewCert = useMemo(
    () => ({
      ...SAMPLE,
      template: {
        html_template: String(form.html_template || ''),
        background_image: form.background_image,
        accent_color: String(form.accent_color || '#4f46e5'),
        issuer_name: String(form.issuer_name || ''),
        issuer_title: String(form.issuer_title || ''),
        signature_image: form.signature_image,
      },
    }),
    [form],
  );

  return (
    <AdminGate>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Certificate templates</h1>
        <p className="mt-1 text-sm text-slate-600">Manage templates and keep exactly one active default for new certificates.</p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Default</th><th className="px-3 py-2">Updated</th><th className="px-3 py-2">Actions</th></tr></thead>
            <tbody className="divide-y">
              {((q.data ?? []) as UnknownRecord[]).map((row) => (
                <tr key={String(row.id)}>
                  <td className="px-3 py-2">{String(row.name ?? '')}</td>
                  <td className="px-3 py-2">{row.is_default ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Active default</span> : '—'}</td>
                  <td className="px-3 py-2">{String(row.date_updated ?? '').slice(0, 19).replace('T', ' ')}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => { setEditing(row); setForm({ ...row }); }}>Edit</button>
                      {!row.is_default ? <button className="rounded border px-2 py-1 text-xs" onClick={() => setDefaultMut.mutate(String(row.id))}>Set as default</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">{editing ? 'Edit template' : 'Create template'}</h2>
            <div className="mt-3 space-y-3">
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Name" value={String(form.name ?? '')} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
              <label className="block text-sm">Background image<input type="file" className="mt-1 block text-xs" onChange={(e) => void upload('background_image', e.target.files?.[0] ?? null)} /></label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Accent color" value={String(form.accent_color ?? '')} onChange={(e) => setForm((s) => ({ ...s, accent_color: e.target.value }))} />
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Issuer name" value={String(form.issuer_name ?? '')} onChange={(e) => setForm((s) => ({ ...s, issuer_name: e.target.value }))} />
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Issuer title" value={String(form.issuer_title ?? '')} onChange={(e) => setForm((s) => ({ ...s, issuer_title: e.target.value }))} />
              <label className="block text-sm">Signature image<input type="file" className="mt-1 block text-xs" onChange={(e) => void upload('signature_image', e.target.files?.[0] ?? null)} /></label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.is_default)} onChange={(e) => setForm((s) => ({ ...s, is_default: e.target.checked }))} /> is_default</label>
              <div>
                <p className="mb-1 text-sm font-medium">HTML template</p>
                <textarea className="min-h-[260px] w-full rounded-lg border bg-slate-950 p-3 font-mono text-xs text-emerald-300" value={String(form.html_template ?? '')} onChange={(e) => setForm((s) => ({ ...s, html_template: e.target.value }))} />
              </div>
              {saveMut.isError ? <p className="text-sm text-rose-600">Save failed.</p> : null}
              <div className="flex gap-2">
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => saveMut.mutate()}>{editing ? 'Save template' : 'Create template'}</button>
                {editing ? <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => { setEditing(null); setForm({ name: '', html_template: '', background_image: null, accent_color: '#4f46e5', issuer_name: '', issuer_title: '', signature_image: null, is_default: false }); }}>Cancel</button> : null}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Live preview</h2>
            <p className="mt-1 text-xs text-slate-500">Sample data: Jane Doe, Sample Course, today, VERIFY-CODE-1234, John Smith, 92.</p>
            <div className="mt-4">
              <CertificateRenderer certificate={previewCert as UnknownRecord} compact />
            </div>
          </section>
        </div>
      </div>
    </AdminGate>
  );
}
