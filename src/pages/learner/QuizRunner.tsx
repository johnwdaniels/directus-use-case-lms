import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight, Clock, Flag, Loader2, X } from 'lucide-react';
import {
  fetchQuizAttemptDetail,
  saveQuizAttemptProgress,
  submitQuizAttempt,
  upsertQuizResponse,
} from '@/api/learner';
import type { UnknownRecord } from '@/api/public';
import { hasDirectusEnv } from '@/lib/directus';
import { RichText } from '@/components/content/RichText';
import { RichTextEditor } from '@/components/content/RichTextEditor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/cn';

type AnswerDraft = {
  selectedOptionIds: string[];
  textAnswer: string;
};

function relationId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id);
  if (value && typeof value === 'object' && 'question_options_id' in value) {
    const nested = (value as { question_options_id?: unknown }).question_options_id;
    return relationId(nested);
  }
  return '';
}

function num(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function sortedRows(value: unknown): UnknownRecord[] {
  return Array.isArray(value)
    ? [...(value as UnknownRecord[])].sort((a, b) => num(a.sort_order) - num(b.sort_order))
    : [];
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function responseMap(rows: UnknownRecord[] | undefined): Record<string, AnswerDraft> {
  const out: Record<string, AnswerDraft> = {};
  for (const row of rows ?? []) {
    const qid = relationId(row.question);
    if (!qid) continue;
    const selected = Array.isArray(row.selected_options)
      ? (row.selected_options as unknown[]).map(relationId).filter(Boolean)
      : [];
    out[qid] = {
      selectedOptionIds: selected,
      textAnswer: str(row.text_answer),
    };
  }
  return out;
}

export default function QuizRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const attemptQ = useQuery({
    queryKey: ['quiz-attempt', attemptId],
    enabled: Boolean(attemptId && hasDirectusEnv() && user?.id),
    queryFn: () => fetchQuizAttemptDetail(attemptId!),
    refetchInterval: (query) => (query.state.data?.status === 'submitted' ? 2000 : false),
  });

  const attempt = attemptQ.data;
  const quiz = attempt?.quiz as UnknownRecord | undefined;
  const questions = useMemo(() => sortedRows(quiz?.questions), [quiz?.questions]);
  const current = questions[index] ?? null;
  const currentId = current ? String(current.id) : '';
  const currentAnswer = answers[currentId] ?? { selectedOptionIds: [], textAnswer: '' };
  const courseSlug = str(((attempt?.enrollment as UnknownRecord | undefined)?.course as UnknownRecord | undefined)?.slug);
  const startedAt = attempt?.started_at ? new Date(String(attempt.started_at)).getTime() : Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const timeLimitMinutes = quiz?.time_limit_minutes == null ? null : num(quiz.time_limit_minutes);
  const remainingSeconds = timeLimitMinutes ? timeLimitMinutes * 60 - elapsedSeconds : null;
  const hasEssay = questions.some((q) => q.question_type === 'essay' || q.question_type === 'short_answer');

  useEffect(() => {
    if (!attempt) return;
    setAnswers(responseMap(attempt.responses as UnknownRecord[] | undefined));
  }, [attempt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const saveAnswerMut = useMutation({
    mutationFn: (payload: { questionId: string; answer: AnswerDraft }) =>
      upsertQuizResponse({
        attemptId: attemptId!,
        questionId: payload.questionId,
        selectedOptionIds: payload.answer.selectedOptionIds,
        textAnswer: payload.answer.textAnswer,
      }),
  });

  const saveExitMut = useMutation({
    mutationFn: () => saveQuizAttemptProgress(attemptId!, elapsedSeconds),
    onSuccess: () => navigate(courseSlug ? `/learn/${encodeURIComponent(courseSlug)}` : '/my/learning'),
  });

  const submitMut = useMutation({
    mutationFn: () => submitQuizAttempt(attemptId!, elapsedSeconds),
    onSuccess: () => navigate(`/quiz/${encodeURIComponent(attemptId!)}/results`, { state: { waitingForInstructor: hasEssay } }),
  });

  function setAnswer(questionId: string, next: AnswerDraft) {
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    saveAnswerMut.mutate({ questionId, answer: next });
  }

  function setSingleOption(optionId: string) {
    if (!currentId) return;
    setAnswer(currentId, { selectedOptionIds: [optionId], textAnswer: '' });
  }

  function toggleMultiOption(optionId: string) {
    if (!currentId) return;
    const selected = new Set(currentAnswer.selectedOptionIds);
    if (selected.has(optionId)) selected.delete(optionId);
    else selected.add(optionId);
    setAnswer(currentId, { selectedOptionIds: [...selected], textAnswer: '' });
  }

  function toggleReview() {
    if (!currentId) return;
    setReviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentId)) next.delete(currentId);
      else next.add(currentId);
      return next;
    });
  }

  if (!hasDirectusEnv()) {
    return <p className="p-6 text-sm text-amber-800">Set VITE_DIRECTUS_URL.</p>;
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <Link to="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          Log in to take this quiz
        </Link>
      </div>
    );
  }

  if (attemptQ.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-white">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading quiz…
      </div>
    );
  }

  if (!attempt || !quiz || !current) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6 text-sm text-rose-700">
        Quiz attempt not found.
      </div>
    );
  }

  const options = sortedRows(current.options);
  const isLast = index === questions.length - 1;
  const qType = str(current.question_type, 'single_choice');
  const counter = `Question ${index + 1} of ${questions.length}`;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{str(quiz.title, 'Quiz')}</p>
            <p className="text-xs text-slate-400">{counter}</p>
          </div>
          <button
            type="button"
            onClick={() => setReviewOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            <Flag className="h-4 w-4" />
            Review ({reviewIds.size})
          </button>
          {remainingSeconds != null ? (
            <div className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold', remainingSeconds < 60 ? 'bg-rose-500 text-white' : 'bg-white/10')}>
              <Clock className="h-4 w-4" />
              {formatDuration(remainingSeconds)}
            </div>
          ) : null}
          <button
            type="button"
            disabled={saveExitMut.isPending}
            onClick={() => saveExitMut.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Save and exit
          </button>
        </div>
        {reviewOpen ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-slate-900 p-3">
            {reviewIds.size ? (
              <div className="flex flex-wrap gap-2">
                {questions.map((q, i) =>
                  reviewIds.has(String(q.id)) ? (
                    <button
                      key={String(q.id)}
                      type="button"
                      onClick={() => {
                        setIndex(i);
                        setReviewOpen(false);
                      }}
                      className="rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold text-amber-950"
                    >
                      Question {i + 1}
                    </button>
                  ) : null,
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No questions marked for review.</p>
            )}
          </div>
        ) : null}
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <section className="w-full max-w-3xl rounded-2xl bg-white p-5 text-slate-900 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {String(qType).replace(/_/g, ' ')}
            </span>
            <span className="text-sm text-slate-500">{num(current.points, 1)} point(s)</span>
          </div>
          <RichText content={str(current.prompt)} />

          <div className="mt-8 space-y-3">
            {qType === 'single_choice'
              ? options.map((option) => {
                  const id = String(option.id);
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                      <input
                        type="radio"
                        name={currentId}
                        checked={currentAnswer.selectedOptionIds.includes(id)}
                        onChange={() => setSingleOption(id)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">{str(option.label, 'Option')}</span>
                    </label>
                  );
                })
              : null}

            {qType === 'multiple_choice'
              ? options.map((option) => {
                  const id = String(option.id);
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={currentAnswer.selectedOptionIds.includes(id)}
                        onChange={() => toggleMultiOption(id)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">{str(option.label, 'Option')}</span>
                    </label>
                  );
                })
              : null}

            {qType === 'true_false' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {['True', 'False'].map((label) => {
                  const option = options.find((o) => str(o.label).toLowerCase() === label.toLowerCase());
                  const optionId = option ? String(option.id) : label.toLowerCase();
                  const selected = currentAnswer.selectedOptionIds.includes(optionId) || currentAnswer.textAnswer === label.toLowerCase();
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setAnswer(currentId, {
                          selectedOptionIds: option ? [optionId] : [],
                          textAnswer: option ? '' : label.toLowerCase(),
                        })
                      }
                      className={cn(
                        'rounded-xl border px-4 py-4 text-sm font-semibold',
                        selected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {qType === 'short_answer' ? (
              <input
                value={currentAnswer.textAnswer}
                onChange={(e) => setAnswer(currentId, { selectedOptionIds: [], textAnswer: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="Type your answer"
              />
            ) : null}

            {qType === 'essay' ? (
              <RichTextEditor
                value={currentAnswer.textAnswer}
                onChange={(html) => setAnswer(currentId, { selectedOptionIds: [], textAnswer: html })}
                placeholder="Write your response"
              />
            ) : null}

            {qType === 'matching' || qType === 'ordering' ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                This question type is not implemented yet.
              </div>
            ) : null}
          </div>

          {saveAnswerMut.isError ? <p className="mt-4 text-sm text-rose-600">Autosave failed. Try changing the answer again.</p> : null}
        </section>
      </main>

      <footer className="sticky bottom-0 z-40 flex items-center gap-3 border-t border-white/10 bg-slate-950 px-4 py-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((v) => Math.max(0, v - 1))}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <button
          type="button"
          onClick={toggleReview}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold',
            reviewIds.has(currentId) ? 'bg-amber-300 text-amber-950' : 'border border-white/10 text-slate-200 hover:bg-white/10',
          )}
        >
          {reviewIds.has(currentId) ? 'Marked for review' : 'Mark for review'}
        </button>
        <div className="flex-1" />
        {isLast ? (
          <button
            type="button"
            disabled={submitMut.isPending}
            onClick={() => {
              if (window.confirm('Submit this quiz? You will not be able to edit these answers.')) submitMut.mutate();
            }}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {submitMut.isPending ? 'Submitting…' : 'Submit quiz'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((v) => Math.min(questions.length - 1, v + 1))}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </footer>
    </div>
  );
}
