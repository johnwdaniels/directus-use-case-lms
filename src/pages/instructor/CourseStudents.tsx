import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { hasDirectusEnv } from '@/lib/directus';
import { InstructorGate } from '@/components/instructor/InstructorGate';
import { fetchEnrollmentsForCourse, fetchLessonProgressForEnrollment } from '@/api/instructor';
import { directusAssetUrl } from '@/lib/assets';
import type { UnknownRecord } from '@/api/public';
import { ProgressBar } from '@/components/courses/ProgressBar';

export default function CourseStudents() {
  const { id: courseId } = useParams<{ id: string }>();
  const { data: user } = useCurrentUser();
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState('');
  const [drawerEnrollment, setDrawerEnrollment] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ['instructor-enrollments', courseId, status, progress],
    enabled: hasDirectusEnv() && Boolean(courseId && user?.id),
    queryFn: () =>
      fetchEnrollmentsForCourse(courseId!, {
        status: status || undefined,
        progress: progress || undefined,
      }),
  });

  const progressQ = useQuery({
    queryKey: ['enrollment-progress-drawer', drawerEnrollment],
    enabled: Boolean(drawerEnrollment),
    queryFn: () => fetchLessonProgressForEnrollment(drawerEnrollment!),
  });

  const rows = (listQ.data ?? []) as UnknownRecord[];

  const filters = useMemo(
    () => (
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="dropped">Dropped</option>
        </select>
        <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={progress} onChange={(e) => setProgress(e.target.value)}>
          <option value="">All progress</option>
          <option value="0">0%</option>
          <option value="1-50">1–50%</option>
          <option value="51-99">51–99%</option>
          <option value="100">100%</option>
        </select>
      </div>
    ),
    [status, progress],
  );

  return (
    <InstructorGate>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Students</h1>
            <p className="mt-1 text-sm text-slate-600">Enrollments and progress for this course.</p>
          </div>
          <Link to={`/instructor/courses/${encodeURIComponent(courseId ?? '')}/edit`} className="text-sm font-medium text-indigo-600 hover:underline">
            ← Back to editor
          </Link>
        </div>

        {filters}

        {listQ.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const u = r.user as UnknownRecord | undefined;
                const name = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || '—';
                const av = directusAssetUrl(u?.avatar as string | { id: string } | null | undefined);
                const pct = Math.min(100, Math.max(0, Number(r.progress_pct ?? 0)));
                return (
                  <tr
                    key={String(r.id)}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setDrawerEnrollment(String(r.id))}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {av ? <img src={av} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-slate-200" />}
                        <span className="font-medium text-slate-900">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{String(u?.email ?? '')}</td>
                    <td className="px-4 py-3 text-slate-600">{r.enrolled_at ? String(r.enrolled_at).slice(0, 10) : '—'}</td>
                    <td className="max-w-[200px] px-4 py-3">
                      <ProgressBar value={pct} size="sm" />
                    </td>
                    <td className="px-4 py-3">{r.final_grade != null ? String(r.final_grade) : '—'}</td>
                    <td className="px-4 py-3">{r.certificate_issued ? 'Yes' : 'No'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drawerEnrollment ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Lesson progress</h2>
              <button type="button" className="text-sm text-slate-600 hover:text-slate-900" onClick={() => setDrawerEnrollment(null)}>
                Close
              </button>
            </div>
            {progressQ.isLoading ? <p className="mt-4 text-sm text-slate-500">Loading…</p> : null}
            <ul className="mt-4 space-y-2 text-sm">
              {((progressQ.data ?? []) as UnknownRecord[]).map((p) => {
                const l = p.lesson as UnknownRecord | undefined;
                return (
                  <li key={String(p.id)} className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="font-medium text-slate-900">{String(l?.title ?? '')}</p>
                    <p className="text-xs text-slate-500">
                      {String(p.status ?? '')}
                      {p.completed_at ? ` · ${String(p.completed_at).slice(0, 10)}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </InstructorGate>
  );
}
