import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, MoreHorizontal, Plus } from 'lucide-react';
import {
  archiveCourse,
  createInstructorCourseDraft,
  duplicateCourse,
  fetchMyInstructorCourses,
  type InstructorCourseTab,
} from '@/api/instructor';
import { fetchRootCategories } from '@/api/public';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { hasDirectusEnv } from '@/lib/directus';
import { InstructorGate } from '@/components/instructor/InstructorGate';
import type { UnknownRecord } from '@/api/public';

const tabs: { id: InstructorCourseTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Draft' },
  { id: 'archived', label: 'Archived' },
];

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? '';
  const cls =
    s === 'published'
      ? 'bg-emerald-100 text-emerald-900'
      : s === 'draft'
        ? 'bg-amber-100 text-amber-900'
        : s === 'archived'
          ? 'bg-slate-200 text-slate-800'
          : 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function MyCourses() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<InstructorCourseTab>('all');
  const [drawer, setDrawer] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const listQ = useQuery({
    queryKey: ['instructor-courses', tab, user?.id],
    enabled: hasDirectusEnv() && Boolean(user?.id),
    queryFn: () => fetchMyInstructorCourses(user!.id, tab),
  });

  const catQ = useQuery({
    queryKey: ['categories', 'roots', 'instructor-create'],
    enabled: hasDirectusEnv() && drawer,
    queryFn: () => fetchRootCategories(),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user?.id || !categoryId) throw new Error('Category required');
      return createInstructorCourseDraft({ title: title.trim() || 'Untitled course', categoryId, instructorId: user.id });
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ['instructor-courses'] });
      setDrawer(false);
      setTitle('');
      navigate(`/instructor/courses/${encodeURIComponent(String(row.id))}/edit`);
    },
  });

  const dupMut = useMutation({
    mutationFn: (courseId: string) => duplicateCourse(courseId, user!.id),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ['instructor-courses'] });
      navigate(`/instructor/courses/${encodeURIComponent(String(row.id))}/edit`);
    },
  });

  const archMut = useMutation({
    mutationFn: (courseId: string) => archiveCourse(courseId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['instructor-courses'] }),
  });

  const rows = (listQ.data ?? []) as UnknownRecord[];

  const categories = useMemo(() => {
    const raw = (catQ.data ?? []) as UnknownRecord[];
    const out: UnknownRecord[] = [];
    function walk(nodes: UnknownRecord[]) {
      for (const n of nodes) {
        out.push(n);
        const ch = n.children as UnknownRecord[] | undefined;
        if (ch?.length) walk(ch);
      }
    }
    walk(raw);
    return out;
  }, [catQ.data]);

  return (
    <InstructorGate>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My courses</h1>
            <p className="mt-1 text-sm text-slate-600">Create, edit, and publish your catalog entries.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            onClick={() => setDrawer(true)}
          >
            <Plus className="h-4 w-4" />
            Create course
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {listQ.isLoading ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : null}
        {listQ.isError ? <p className="mt-6 text-sm text-rose-600">Could not load courses.</p> : null}

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Completions</th>
                <th className="px-4 py-3">Avg rating</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{String(r.title ?? '')}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={String(r.status ?? '')} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">{String(r.enrollment_count ?? 0)}</td>
                  <td className="px-4 py-3 text-slate-700">{String(r.completion_count ?? 0)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.average_rating != null ? Number(r.average_rating).toFixed(1) : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.published_at ? String(r.published_at).slice(0, 10) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        to={`/instructor/courses/${encodeURIComponent(String(r.id))}/edit`}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <a
                        href={`/courses/${encodeURIComponent(String(r.slug ?? ''))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                      <details className="relative">
                        <summary className="list-none cursor-pointer rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                          <MoreHorizontal className="h-4 w-4" />
                        </summary>
                        <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                            disabled={dupMut.isPending}
                            onClick={() => dupMut.mutate(String(r.id))}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-xs text-rose-700 hover:bg-rose-50"
                            disabled={archMut.isPending}
                            onClick={() => {
                              if (confirm('Archive this course?')) archMut.mutate(String(r.id));
                            }}
                          >
                            Archive
                          </button>
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && listQ.isSuccess ? <p className="p-6 text-center text-sm text-slate-500">No courses in this tab.</p> : null}
        </div>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Create course">
          <div className="h-full w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">New course</h2>
            <p className="mt-1 text-sm text-slate-600">Enter a title and category. You will continue in the full editor.</p>
            <label className="mt-6 block text-sm">
              <span className="font-medium text-slate-700">Title</span>
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Intro to Analytics" />
            </label>
            <label className="mt-4 block text-sm">
              <span className="font-medium text-slate-700">Category</span>
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name ?? '')}
                  </option>
                ))}
              </select>
            </label>
            {createMut.isError ? <p className="mt-3 text-xs text-rose-600">Could not create (check permissions).</p> : null}
            <div className="mt-8 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium" onClick={() => setDrawer(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!categoryId || createMut.isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? 'Creating…' : 'Create & edit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </InstructorGate>
  );
}
