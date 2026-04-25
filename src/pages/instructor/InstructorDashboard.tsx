import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Megaphone, Users, BookOpen, ClipboardList, DollarSign, Star } from 'lucide-react';
import { fetchInstructorDashboard } from '@/api/instructor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { hasDirectusEnv } from '@/lib/directus';
import { InstructorGate } from '@/components/instructor/InstructorGate';
import { directusAssetUrl } from '@/lib/assets';
import type { UnknownRecord } from '@/api/public';

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  to,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  hint?: string;
  to?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <Icon className="h-8 w-8 shrink-0 text-indigo-500" aria-hidden />
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block transition hover:opacity-95">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function InstructorDashboard() {
  const { data: user } = useCurrentUser();
  const q = useQuery({
    queryKey: ['instructor-dashboard', user?.id],
    enabled: hasDirectusEnv() && Boolean(user?.id),
    queryFn: () => fetchInstructorDashboard(user!.id),
  });

  return (
    <InstructorGate>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Instructor dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Overview of your courses, learners, and grading work.</p>

        {!hasDirectusEnv() ? <p className="mt-6 text-sm text-amber-800">Set VITE_DIRECTUS_URL.</p> : null}

        {q.isLoading ? <p className="mt-8 text-sm text-slate-500">Loading…</p> : null}
        {q.isError ? <p className="mt-8 text-sm text-rose-600">Could not load dashboard (permissions or network).</p> : null}

        {q.data ? (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Unique learners" value={q.data.totalStudents} icon={Users} />
              <StatCard label="Published courses" value={q.data.publishedCount} icon={BookOpen} to="/instructor/courses" />
              <StatCard
                label="Pending grading"
                value={q.data.pendingGrading}
                icon={ClipboardList}
                to={q.data.firstGradingCourseId ? `/instructor/courses/${q.data.firstGradingCourseId}/grading` : '/instructor/courses'}
                hint="Submissions + essay quiz responses"
              />
              <StatCard
                label="Template revenue"
                value={`$${q.data.revenuePlaceholder.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                icon={DollarSign}
                hint="enrollment_count × price — not real billing in v1"
              />
              <StatCard label="Avg. rating (your courses)" value={q.data.avgRating.toFixed(2)} icon={Star} />
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <section>
                <h2 className="text-lg font-semibold text-slate-900">Recent enrollments</h2>
                <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                  {(q.data.recentEnrollments as UnknownRecord[]).length ? (
                    (q.data.recentEnrollments as UnknownRecord[]).map((row) => {
                      const u = row.user as UnknownRecord | undefined;
                      const c = row.course as UnknownRecord | undefined;
                      const name = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || String(u?.email ?? 'Student');
                      const av = directusAssetUrl(u?.avatar as string | { id: string } | null | undefined);
                      return (
                        <li key={String(row.id)} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                          {av ? <img src={av} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-slate-200" />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-slate-900">{name}</p>
                            <p className="truncate text-xs text-slate-500">{String(c?.title ?? '')}</p>
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">{row.enrolled_at ? String(row.enrolled_at).slice(0, 10) : ''}</span>
                        </li>
                      );
                    })
                  ) : (
                    <li className="px-3 py-6 text-center text-sm text-slate-500">No recent enrollments.</li>
                  )}
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">Your announcements</h2>
                <ul className="mt-3 space-y-2">
                  {q.data.announcements.length ? (
                    q.data.announcements.map((a) => {
                      const course = a.course as UnknownRecord | undefined;
                      return (
                        <li key={String(a.id)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start gap-2">
                            <Megaphone className="mt-0.5 h-4 w-4 text-indigo-500" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900">{String(a.title ?? '')}</p>
                              <p className="text-xs text-slate-500">{course?.title ? String(course.title) : 'Course'}</p>
                              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{String(a.body ?? '').replace(/<[^>]+>/g, ' ')}</p>
                            </div>
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-sm text-slate-500">No course announcements yet.</li>
                  )}
                </ul>
              </section>
            </div>

            <p className="mt-8 text-sm text-slate-600">
              Manage courses in{' '}
              <Link to="/instructor/courses" className="font-medium text-indigo-600 hover:underline">
                My courses
              </Link>
              .
            </p>
          </>
        ) : null}
      </div>
    </InstructorGate>
  );
}
