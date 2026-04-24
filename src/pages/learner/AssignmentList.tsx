import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Loader2 } from 'lucide-react';
import { fetchAssignmentsForLearner } from '@/api/learner';
import type { UnknownRecord } from '@/api/public';
import { hasDirectusEnv } from '@/lib/directus';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/cn';

function str(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function submissionForUser(assignment: UnknownRecord, userId: string) {
  const submissions = Array.isArray(assignment.submissions) ? (assignment.submissions as UnknownRecord[]) : [];
  return submissions.find((s) => {
    const user = s.user;
    if (typeof user === 'string') return user === userId;
    return user && typeof user === 'object' && 'id' in user && String((user as { id: unknown }).id) === userId;
  }) ?? null;
}

function dueLabel(value: unknown) {
  if (!value) return 'No due date';
  return new Date(String(value)).toLocaleString();
}

function statusClass(status: string) {
  if (status === 'graded') return 'bg-emerald-100 text-emerald-800';
  if (status === 'submitted') return 'bg-indigo-100 text-indigo-800';
  if (status === 'returned_for_revision') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

export default function AssignmentList() {
  const { data: user } = useCurrentUser();
  const assignmentsQ = useQuery({
    queryKey: ['my-assignments', user?.id],
    enabled: Boolean(user?.id && hasDirectusEnv()),
    queryFn: () => fetchAssignmentsForLearner(user!.id),
  });

  if (!hasDirectusEnv()) {
    return <p className="p-6 text-sm text-amber-800">Set VITE_DIRECTUS_URL.</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Link to="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          Log in to view assignments
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My assignments</h1>
        <p className="mt-1 text-sm text-slate-600">Track due dates, submission status, and grades across your courses.</p>
      </header>

      {assignmentsQ.isLoading ? (
        <p className="mt-8 text-sm text-slate-600">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading assignments…
        </p>
      ) : null}

      {assignmentsQ.isSuccess && !assignmentsQ.data.length ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No assignments found.
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {(assignmentsQ.data ?? []).map((assignment) => {
          const course = (assignment.course as UnknownRecord | undefined) ?? {};
          const submission = submissionForUser(assignment, user.id);
          const status = str(submission?.status, 'not_started');
          const grade = submission?.grade == null ? null : num(submission.grade);
          const due = assignment.due_date ? new Date(String(assignment.due_date)).getTime() : null;
          const late = due != null && due < Date.now() && status !== 'submitted' && status !== 'graded';
          return (
            <Link
              key={String(assignment.id)}
              to={`/assignment/${encodeURIComponent(String(assignment.id))}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-indigo-600">{str(course.title, 'Course')}</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{str(assignment.title, 'Assignment')}</h2>
                  <p className={cn('mt-2 flex items-center gap-2 text-sm', late ? 'text-amber-700' : 'text-slate-600')}>
                    <CalendarDays className="h-4 w-4" />
                    {dueLabel(assignment.due_date)}
                    {late ? ' (late)' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', statusClass(status))}>
                    {status.replace(/_/g, ' ')}
                  </span>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {grade == null ? 'Grade pending' : `${grade}/${num(assignment.max_points, 100)}`}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
