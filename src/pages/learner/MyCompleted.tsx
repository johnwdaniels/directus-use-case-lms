import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Award } from 'lucide-react';
import { fetchMyEnrollments } from '@/api/learner';
import { directusAssetUrl } from '@/lib/assets';
import { hasDirectusEnv } from '@/lib/directus';
import { mapEnrollmentCourse } from '@/lib/learner-ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import type { UnknownRecord } from '@/api/public';

export default function MyCompleted() {
  const { data: user } = useCurrentUser();
  const enabled = hasDirectusEnv() && Boolean(user?.id);

  const q = useQuery({
    queryKey: ['enrollments', 'completed', user?.id],
    enabled,
    queryFn: () => fetchMyEnrollments(user!.id, 'completed'),
  });

  if (!hasDirectusEnv()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-sm text-amber-800">Set VITE_DIRECTUS_URL to load completed courses.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EmptyState
          icon={Award}
          title="Sign in"
          description="Log in to see completed courses."
          primaryLabel="Log in"
          onPrimary={() => {
            window.location.href = '/login';
          }}
        />
      </div>
    );
  }

  const rows = (q.data ?? []) as UnknownRecord[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Completed courses</h1>
      <p className="mt-1 text-sm text-slate-600">Everything you have finished.</p>

      {q.isLoading ? <p className="mt-8 text-sm text-slate-500">Loading…</p> : null}

      {!q.isLoading && !rows.length ? (
        <div className="mt-10">
          <EmptyState
            icon={Award}
            title="No completions yet"
            description="Complete a course to see it listed here."
            primaryLabel="Browse courses"
            onPrimary={() => {
              window.location.href = '/courses';
            }}
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const course = mapEnrollmentCourse(row);
            if (!course) return null;
            const cover = directusAssetUrl(course.cover_image);
            const completedAt = row.completed_at ? format(new Date(String(row.completed_at)), 'PP') : '—';
            const grade = row.final_grade != null && row.final_grade !== '' ? String(row.final_grade) : null;
            const cert = Boolean(row.certificate_issued);
            return (
              <li
                key={String(row.id)}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="relative aspect-video bg-slate-100">
                  {cover ? <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h2 className="line-clamp-2 font-semibold text-slate-900">{course.title}</h2>
                  <dl className="space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between gap-2">
                      <dt>Completed</dt>
                      <dd className="font-medium text-slate-800">{completedAt}</dd>
                    </div>
                    {grade ? (
                      <div className="flex justify-between gap-2">
                        <dt>Final grade</dt>
                        <dd className="font-medium text-slate-800">{grade}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {cert ? (
                    <Link
                      to="/my/certificates"
                      className="mt-auto inline-flex justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      View certificate
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
