import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteReview, fetchAdminCoursesLite, fetchReviewsForModeration, updateReview } from '@/api/admin';
import { AdminGate } from '@/components/admin/AdminGate';
import type { UnknownRecord } from '@/api/public';

export default function ReviewsModerate() {
  const qc = useQueryClient();
  const [approvedOnly, setApprovedOnly] = useState('false');
  const [course, setCourse] = useState('');
  const [rating, setRating] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const q = useQuery({
    queryKey: ['reviews-moderate', approvedOnly, course, rating],
    queryFn: () =>
      fetchReviewsForModeration({
        approved: approvedOnly === '' ? undefined : approvedOnly === 'true',
        course: course || undefined,
        rating: rating || undefined,
      }),
  });
  const coursesQ = useQuery({ queryKey: ['admin-courses-lite'], queryFn: fetchAdminCoursesLite });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UnknownRecord }) => updateReview(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reviews-moderate'] }),
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => deleteReview(id), onSuccess: () => void qc.invalidateQueries({ queryKey: ['reviews-moderate'] }) });

  const rows = (q.data ?? []) as UnknownRecord[];
  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);

  return (
    <AdminGate>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Review moderation</h1>
        <p className="mt-1 text-sm text-slate-600">Approve, reject, or delete course reviews with bulk selection.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <select className="rounded-lg border px-3 py-2 text-sm" value={approvedOnly} onChange={(e) => setApprovedOnly(e.target.value)}>
            <option value="false">Pending only</option><option value="">All</option><option value="true">Approved only</option>
          </select>
          <select className="rounded-lg border px-3 py-2 text-sm" value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">All courses</option>
            {((coursesQ.data ?? []) as UnknownRecord[]).map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.title ?? '')}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2 text-sm" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">All ratings</option>{[5,4,3,2,1].map((r) => <option key={r} value={String(r)}>{r}</option>)}
          </select>
        </div>

        <div className="mt-3 flex gap-2">
          <button className="rounded border px-3 py-1.5 text-xs" disabled={!selectedIds.length} onClick={() => selectedIds.forEach((id) => updateMut.mutate({ id, payload: { is_approved: true } }))}>Approve selected</button>
          <button className="rounded border px-3 py-1.5 text-xs" disabled={!selectedIds.length} onClick={() => selectedIds.forEach((id) => updateMut.mutate({ id, payload: { is_approved: false } }))}>Reject selected</button>
          <button className="rounded border border-rose-200 px-3 py-1.5 text-xs text-rose-700" disabled={!selectedIds.length} onClick={() => { if (confirm('Delete selected reviews?')) selectedIds.forEach((id) => deleteMut.mutate(id)); }}>Delete selected</button>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50"><tr><th className="px-3 py-2"><input type="checkbox" checked={rows.length > 0 && selectedIds.length === rows.length} onChange={(e) => setSelected(Object.fromEntries(rows.map((r) => [String(r.id), e.target.checked])))} /></th><th className="px-3 py-2">Course</th><th className="px-3 py-2">Rating</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th></tr></thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td className="px-3 py-2"><input type="checkbox" checked={Boolean(selected[String(r.id)])} onChange={(e) => setSelected((s) => ({ ...s, [String(r.id)]: e.target.checked }))} /></td>
                  <td className="px-3 py-2">{String((r.course as UnknownRecord | undefined)?.title ?? '')}</td>
                  <td className="px-3 py-2">{String(r.rating ?? '')}</td>
                  <td className="px-3 py-2">{String(r.title ?? '')}</td>
                  <td className="px-3 py-2">{r.is_approved ? 'approved' : 'pending'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => updateMut.mutate({ id: String(r.id), payload: { is_approved: true } })}>Approve</button>
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => updateMut.mutate({ id: String(r.id), payload: { is_approved: false } })}>Reject</button>
                      <button className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => deleteMut.mutate(String(r.id))}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminGate>
  );
}
