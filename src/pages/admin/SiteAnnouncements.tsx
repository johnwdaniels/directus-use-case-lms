import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSiteAnnouncement, fetchSiteAnnouncements } from '@/api/admin';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AdminGate } from '@/components/admin/AdminGate';
import type { UnknownRecord } from '@/api/public';

export default function SiteAnnouncements() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const q = useQuery({ queryKey: ['site-announcements'], queryFn: fetchSiteAnnouncements });
  const createMut = useMutation({
    mutationFn: () => createSiteAnnouncement({ title, body, is_pinned: isPinned, author: user?.id ?? null, course: null }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setIsPinned(false);
      void qc.invalidateQueries({ queryKey: ['site-announcements'] });
    },
  });

  return (
    <AdminGate>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Site announcements</h1>
        <p className="mt-1 text-sm text-slate-600">Create and manage site-wide announcements (`course = null`).</p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Create announcement</h2>
          <div className="mt-3 space-y-3">
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="min-h-[120px] w-full rounded-lg border px-3 py-2 text-sm" placeholder="Body (supports html/plain text depending on Directus field)" value={body} onChange={(e) => setBody(e.target.value)} />
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} /> Pin announcement</label>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => createMut.mutate()} disabled={createMut.isPending || !title.trim()}>{createMut.isPending ? 'Publishing…' : 'Publish site announcement'}</button>
          </div>
        </div>

        <ul className="mt-6 space-y-2">
          {((q.data ?? []) as UnknownRecord[]).map((a) => (
            <li key={String(a.id)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{String(a.title ?? '')}</h3>
                <div className="text-xs text-slate-500">{a.is_pinned ? 'Pinned' : 'Not pinned'}</div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{String(a.body ?? '').replace(/<[^>]+>/g, ' ')}</p>
              <p className="mt-2 text-xs text-slate-500">{String(a.published_at ?? '').slice(0, 19).replace('T', ' ')}</p>
            </li>
          ))}
        </ul>
      </div>
    </AdminGate>
  );
}
