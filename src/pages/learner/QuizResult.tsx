import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { fetchQuizAttemptDetail } from '@/api/learner';
import type { UnknownRecord } from '@/api/public';
import { hasDirectusEnv } from '@/lib/directus';
import { RichText } from '@/components/content/RichText';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/cn';

function relationId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id);
  if (value && typeof value === 'object' && 'question_options_id' in value) {
    return relationId((value as { question_options_id?: unknown }).question_options_id);
  }
  return '';
}

function str(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function rows(value: unknown): UnknownRecord[] {
  return Array.isArray(value)
    ? [...(value as UnknownRecord[])].sort((a, b) => num(a.sort_order) - num(b.sort_order))
    : [];
}

function responseFor(questionId: string, responses: UnknownRecord[]) {
  return responses.find((r) => relationId(r.question) === questionId) ?? null;
}

function selectedIds(response: UnknownRecord | null) {
  return Array.isArray(response?.selected_options)
    ? (response.selected_options as unknown[]).map(relationId).filter(Boolean)
    : [];
}

function canShowCorrectAnswers(quiz: UnknownRecord, attempt: UnknownRecord) {
  const rule = str(quiz.show_correct_answers, 'after_each_attempt');
  if (rule === 'never') return false;
  if (rule === 'after_each_attempt') return true;
  if (rule === 'after_passing') return attempt.passed === true;
  if (rule === 'after_all_attempts') {
    const max = quiz.max_attempts == null ? null : num(quiz.max_attempts);
    return max != null && num(attempt.attempt_number, 1) >= max;
  }
  return false;
}

export default function QuizResult() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const waitingForInstructor = Boolean((location.state as { waitingForInstructor?: boolean } | null)?.waitingForInstructor);

  const attemptQ = useQuery({
    queryKey: ['quiz-attempt-result', attemptId],
    enabled: Boolean(attemptId && hasDirectusEnv() && user?.id),
    queryFn: () => fetchQuizAttemptDetail(attemptId!),
    refetchInterval: (query) => (query.state.data?.status !== 'graded' && !waitingForInstructor ? 2000 : false),
  });

  if (!hasDirectusEnv()) {
    return <p className="p-6 text-sm text-amber-800">Set VITE_DIRECTUS_URL.</p>;
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <Link to="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          Log in to view results
        </Link>
      </div>
    );
  }

  if (attemptQ.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-600">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading results…
      </div>
    );
  }

  const attempt = attemptQ.data;
  const quiz = attempt?.quiz as UnknownRecord | undefined;
  if (!attempt || !quiz) {
    return <div className="p-6 text-sm text-rose-700">Quiz attempt not found.</div>;
  }

  const course = ((attempt.enrollment as UnknownRecord | undefined)?.course as UnknownRecord | undefined) ?? {};
  const courseSlug = str(course.slug);
  const questions = rows(quiz.questions);
  const responses = rows(attempt.responses);
  const status = str(attempt.status, 'submitted');
  const graded = status === 'graded';
  const showBreakdown = canShowCorrectAnswers(quiz, attempt);
  const passed = attempt.passed === true;
  const score = attempt.score == null ? null : num(attempt.score);
  const waiting = !graded;

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8 sm:px-6">
      <main className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-indigo-600">{str(quiz.title, 'Quiz')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">Quiz results</h1>
            {graded ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold',
                  passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
                )}
              >
                {passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {passed ? 'Passed' : 'Failed'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                <Clock className="h-4 w-4" />
                {waitingForInstructor ? 'Waiting for instructor' : 'Grading in progress'}
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Score</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{score == null ? 'Pending' : `${score}%`}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Points</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {num(attempt.points_earned)}/{num(attempt.points_possible)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Attempt</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">#{num(attempt.attempt_number, 1)}</p>
            </div>
          </div>

          {waiting ? (
            <p className="mt-4 text-sm text-slate-600">
              {waitingForInstructor
                ? 'Essay or short-answer responses need instructor review before the final score is available.'
                : 'The quiz has been submitted. This page will refresh while the grading flow runs.'}
            </p>
          ) : null}

          <Link
            to={courseSlug ? `/learn/${encodeURIComponent(courseSlug)}` : '/my/learning'}
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to course
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Question breakdown</h2>
          {!showBreakdown ? (
            <p className="mt-2 text-sm text-slate-600">Correct answers are not available at this stage.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {questions.map((question, i) => {
                const response = responseFor(String(question.id), responses);
                const selected = selectedIds(response);
                const options = rows(question.options);
                return (
                  <article key={String(question.id)} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-500">Question {i + 1}</p>
                        <RichText content={str(question.prompt)} />
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                          response?.is_correct === true
                            ? 'bg-emerald-100 text-emerald-800'
                            : response?.is_correct === false
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800',
                        )}
                      >
                        {response?.is_correct === true ? 'Correct' : response?.is_correct === false ? 'Incorrect' : 'Pending'}
                      </span>
                    </div>

                    {options.length ? (
                      <ul className="mt-3 space-y-2">
                        {options.map((option) => {
                          const id = String(option.id);
                          const chosen = selected.includes(id);
                          const correct = option.is_correct === true;
                          return (
                            <li
                              key={id}
                              className={cn(
                                'rounded-lg border px-3 py-2 text-sm',
                                correct ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200',
                                chosen && !correct ? 'border-rose-200 bg-rose-50 text-rose-900' : '',
                              )}
                            >
                              {str(option.label, 'Option')}
                              {chosen ? ' (your answer)' : ''}
                              {correct ? ' (correct)' : ''}
                            </li>
                          );
                        })}
                      </ul>
                    ) : response?.text_answer ? (
                      <div className="prose prose-sm mt-3 max-w-none rounded-lg bg-slate-50 p-3 text-slate-700">
                        <RichText content={str(response.text_answer)} />
                      </div>
                    ) : null}

                    {question.explanation ? (
                      <div className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">
                        <p className="font-semibold">Explanation</p>
                        <RichText content={str(question.explanation)} />
                      </div>
                    ) : null}
                    {response?.grader_feedback ? (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-semibold">Feedback</p>
                        <RichText content={str(response.grader_feedback)} />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
