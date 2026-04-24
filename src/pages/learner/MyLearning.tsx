import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { fetchContinueEnrollments, fetchMyEnrollments, type EnrollmentTab } from '@/api/learner';
import { hasDirectusEnv } from '@/lib/directus';
import { mapEnrollmentCourse } from '@/lib/learner-ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CourseCard } from '@/components/courses/CourseCard';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import type { UnknownRecord } from '@/api/public';

const tabs: { id: EnrollmentTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'dropped', label: 'Dropped' },
];

export default function MyLearning() {
  const { data: user } = useCurrentUser();
  const [tab, setTab] = useState<EnrollmentTab>('all');
  const enabled = hasDirectusEnv() && Boolean(user?.id);

  const continueQ = useQuery({
    queryKey: ['enrollments', 'continue', user?.id],
    enabled,
    queryFn: () => fetchContinueEnrollments(user!.id),
  });

  const listQ = useQuery({
    queryKey: ['enrollments', tab, user?.id],
    enabled,
    queryFn: () => fetchMyEnrollments(user!.id, tab),
  });

  const continueIds = useMemo(() => new Set((continueQ.data ?? []).map((r) => String(r.id))), [continueQ.data]);

  const continueCourses = useMemo(
    () =>
      (continueQ.data ?? [])
        .map(mapEnrollmentCourse)
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [continueQ.data],
  );

  const gridRows = useMemo(() => {
    const rows = (listQ.data ?? []) as UnknownRecord[];
    if (tab !== 'all') return rows;
    return rows.filter((r) => !continueIds.has(String(r.id)));
  }, [listQ.data, tab, continueIds]);

  const gridCourses = useMemo(
    () => gridRows.map(mapEnrollmentCourse).filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [gridRows],
  );

  if (!hasDirectusEnv()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-sm text-amber-800">Set VITE_DIRECTUS_URL to load your enrollments.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EmptyState
          icon={BookOpen}
          title="Sign in to see your learning"
          description="Log in with your learner account to view enrollments and resume courses."
          primaryLabel="Log in"
          onPrimary={() => {
            window.location.href = '/login';
          }}
        />
      </div>
    );
  }

  const empty = listQ.isSuccess && (listQ.data ?? []).length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Learning</h1>
          <p className="mt-1 text-sm text-slate-600">Courses you are enrolled in and your progress.</p>
        </div>
        <Link to="/courses" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          Browse catalog
        </Link>
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

      {empty ? (
        <div className="mt-10">
          <EmptyState
            icon={BookOpen}
            title="Nothing here yet"
            description="You have not enrolled in anything yet. Browse the catalog."
            primaryLabel="Browse the catalog"
            onPrimary={() => {
              window.location.href = '/courses';
            }}
          />
        </div>
      ) : (
        <>
          {tab === 'all' && continueCourses.length ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Continue learning</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {continueCourses.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    variant="continue"
                    continueHref={`/learn/${encodeURIComponent(c.slug)}`}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-slate-900">
              {tab === 'all' ? 'All enrollments' : `${tabs.find((x) => x.id === tab)?.label}`}
            </h2>
            {listQ.isLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading…</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(tab === 'all' ? gridCourses : (listQ.data ?? []).map(mapEnrollmentCourse).filter(Boolean)).map(
                  (c) =>
                    c ? (
                      <CourseCard
                        key={c.id}
                        course={c}
                        variant="continue"
                        continueHref={`/learn/${encodeURIComponent(c.slug)}`}
                      />
                    ) : null,
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
