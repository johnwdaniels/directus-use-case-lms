import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  createQuizAttemptForUser,
  fetchCourseForPlayer,
  fetchEnrollmentByCourseSlug,
  fetchLessonProgressForEnrollment,
  fetchLessonResources,
  fetchQuizAttemptsForUser,
} from '@/api/learner';
import type { UnknownRecord } from '@/api/public';
import { directusAssetUrl } from '@/lib/assets';
import { hasDirectusEnv } from '@/lib/directus';
import { mapToCourseWithCurriculum } from '@/lib/map-entities';
import {
  flushLessonProgressDebounced,
  markLessonComplete,
  upsertLessonProgress,
} from '@/lib/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CurriculumOutline } from '@/components/courses/CurriculumOutline';
import { VideoPlayer } from '@/components/content/VideoPlayer';
import { RichText } from '@/components/content/RichText';
import { PdfViewer } from '@/components/content/PdfViewer';
import { ProgressBar } from '@/components/courses/ProgressBar';
import type { CourseWithCurriculum, Lesson, LessonProgressStatus, VideoChapter } from '@/types/lms';
import { cn } from '@/lib/cn';

function flattenLessons(course: CourseWithCurriculum): Lesson[] {
  const mods = [...(course.modules ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const out: Lesson[] = [];
  for (const m of mods) {
    const ls = [...(m.lessons ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    out.push(...ls);
  }
  return out;
}

function lessonKeyFromProgressRow(r: UnknownRecord): string {
  const le = r.lesson;
  if (le && typeof le === 'object' && 'id' in le) return String((le as { id: string }).id);
  return String(le ?? '');
}

function progressRecord(rows: UnknownRecord[]): Record<string, LessonProgressStatus> {
  const m: Record<string, LessonProgressStatus> = {};
  for (const r of rows) {
    const lid = lessonKeyFromProgressRow(r);
    if (!lid) continue;
    const st = String(r.status ?? '');
    if (st === 'completed' || st === 'in_progress') m[lid] = st as LessonProgressStatus;
  }
  return m;
}

function progressByLesson(rows: UnknownRecord[]): Map<string, UnknownRecord> {
  const map = new Map<string, UnknownRecord>();
  for (const r of rows) {
    const lid = lessonKeyFromProgressRow(r);
    if (lid) map.set(lid, r);
  }
  return map;
}

function parseChapters(raw: Lesson['video_chapters']): VideoChapter[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((c) => typeof c?.start === 'number' && typeof c?.title === 'string');
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? parseChapters(v as VideoChapter[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function transcriptActiveLineIndex(lines: string[], currentSec: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]?.match(/^\s*\[(\d{1,2}):(\d{2})\]/);
    if (!m) continue;
    const t = Number.parseInt(m[1]!, 10) * 60 + Number.parseInt(m[2]!, 10);
    if (t <= currentSec) idx = i;
  }
  return idx;
}

function resolveQuiz(lesson: Lesson) {
  const q = lesson.quiz;
  if (q && typeof q === 'object' && 'id' in q) return q as { id: string; title?: string | null; description?: string | null; time_limit_minutes?: number | null; max_attempts?: number | null; passing_score?: number | null };
  return null;
}

function resolveAssignment(lesson: Lesson) {
  const a = lesson.assignment;
  if (a && typeof a === 'object' && 'id' in a)
    return a as {
      id: string;
      title?: string | null;
      description?: string | null;
      instructions?: string | null;
      due_date?: string | null;
      max_points?: number | string | null;
    };
  return null;
}

export default function CoursePlayer() {
  const { courseSlug, lessonId } = useParams<{ courseSlug: string; lessonId?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'transcript' | 'chapters' | 'resources'>('transcript');
  const [playheadSec, setPlayheadSec] = useState(0);
  const seekIdRef = useRef(0);
  const [seekRequest, setSeekRequest] = useState<{ id: number; seconds: number } | null>(null);
  const currentLessonIdRef = useRef<string | null>(null);

  const enabled = hasDirectusEnv() && Boolean(courseSlug && user?.id);

  const courseQ = useQuery({
    queryKey: ['course', courseSlug],
    enabled: Boolean(courseSlug && hasDirectusEnv()),
    queryFn: () => fetchCourseForPlayer(courseSlug!),
  });

  const rawCourse = courseQ.data as UnknownRecord | null | undefined;
  const course = useMemo(() => (rawCourse ? mapToCourseWithCurriculum(rawCourse) : null), [rawCourse]);
  const lessons = useMemo(() => (course ? flattenLessons(course) : []), [course]);

  const enrollQ = useQuery({
    queryKey: ['enrollment', courseSlug, user?.id],
    enabled: Boolean(enabled && courseSlug),
    queryFn: () => fetchEnrollmentByCourseSlug(courseSlug!, user!.id),
  });

  const enrollment = enrollQ.data as UnknownRecord | null | undefined;
  const enrollmentId = enrollment?.id != null ? String(enrollment.id) : '';

  const progQ = useQuery({
    queryKey: ['lesson-progress', enrollmentId],
    enabled: Boolean(enrollmentId && user?.id),
    queryFn: () => fetchLessonProgressForEnrollment(enrollmentId, user!.id),
  });

  const progRows = (progQ.data ?? []) as UnknownRecord[];
  const progress = useMemo(() => progressRecord(progRows), [progRows]);
  const byLesson = useMemo(() => progressByLesson(progRows), [progRows]);

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (!lessons.length) return;
    if (lessonId && lessons.some((l) => l.id === lessonId)) {
      setActiveLessonId(lessonId);
      return;
    }
    setActiveLessonId(lessons[0]!.id);
  }, [lessons, lessonId]);

  useEffect(() => {
    if (!courseSlug || !activeLessonId) return;
    if (lessonId === activeLessonId) return;
    navigate(`/learn/${encodeURIComponent(courseSlug)}/${encodeURIComponent(activeLessonId)}`, { replace: true });
  }, [activeLessonId, courseSlug, lessonId, navigate]);

  useEffect(() => {
    if (enrollQ.isSuccess && !enrollment && courseSlug) {
      navigate(`/courses/${encodeURIComponent(courseSlug)}`, { replace: true });
    }
  }, [enrollQ.isSuccess, enrollment, courseSlug, navigate]);

  const activeLesson = useMemo(
    () => lessons.find((l) => l.id === activeLessonId) ?? null,
    [lessons, activeLessonId],
  );
  const activeQuiz = activeLesson ? resolveQuiz(activeLesson) : null;

  useEffect(() => {
    currentLessonIdRef.current = activeLesson?.id ?? null;
  }, [activeLesson?.id]);

  useEffect(() => {
    return () => {
      const lid = currentLessonIdRef.current;
      if (lid && enrollmentId && user?.id) void flushLessonProgressDebounced(lid, enrollmentId, user.id);
    };
  }, [enrollmentId, user?.id]);

  const invalidateProgress = useCallback(() => {
    if (courseSlug) void qc.invalidateQueries({ queryKey: ['enrollment', courseSlug] });
    if (course?.id) void qc.invalidateQueries({ queryKey: ['course-progress', course.id] });
    void qc.invalidateQueries({ queryKey: ['lesson-progress', enrollmentId] });
  }, [qc, courseSlug, course?.id, enrollmentId]);

  const completeMut = useMutation({
    mutationFn: async (lid: string) => {
      await markLessonComplete(lid, enrollmentId, user!.id);
    },
    onSuccess: () => invalidateProgress(),
  });

  const quizStartMut = useMutation({
    mutationFn: async (quizId: string) => {
      const row = await createQuizAttemptForUser({
        userId: user!.id,
        quizId,
        enrollmentId,
      });
      return String(row.id);
    },
    onSuccess: (attemptId) => navigate(`/quiz/${encodeURIComponent(attemptId)}`),
  });

  const resourcesQ = useQuery({
    queryKey: ['lesson-resources', activeLesson?.id],
    enabled: Boolean(activeLesson?.id && rightTab === 'resources'),
    queryFn: () => fetchLessonResources(activeLesson!.id),
  });

  const quizAttemptsQ = useQuery({
    queryKey: ['quiz-attempts', activeQuiz?.id, user?.id],
    enabled: Boolean(activeQuiz?.id && user?.id),
    queryFn: () => fetchQuizAttemptsForUser(user!.id, activeQuiz!.id),
  });

  const seekToSeconds = useCallback((sec: number) => {
    seekIdRef.current += 1;
    const id = seekIdRef.current;
    setSeekRequest({ id, seconds: sec });
    window.setTimeout(() => setSeekRequest((cur) => (cur?.id === id ? null : cur)), 400);
  }, []);

  const goLesson = useCallback(
    (dir: -1 | 1) => {
      if (!activeLessonId) return;
      const i = lessons.findIndex((l) => l.id === activeLessonId);
      const next = lessons[i + dir];
      if (next) setActiveLessonId(next.id);
    },
    [lessons, activeLessonId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goLesson(-1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goLesson(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goLesson]);

  const activeLessonRef = useRef<Lesson | null>(null);
  useEffect(() => {
    activeLessonRef.current = activeLesson;
  }, [activeLesson]);

  useEffect(() => {
    setPlayheadSec(0);
  }, [activeLessonId]);

  const videoProgressHandler = useCallback(
    (state: { position: number; watched: number; duration: number }) => {
      const al = activeLessonRef.current;
      if (!al || !enrollmentId || !user?.id) return;
      upsertLessonProgress(al.id, enrollmentId, user.id, {
        last_position_seconds: Math.floor(state.position),
        watched_seconds: Math.floor(state.watched),
        time_spent_seconds: Math.floor(state.watched),
        status: 'in_progress',
      });
    },
    [enrollmentId, user?.id],
  );

  const videoCompleteHandler = useCallback(async () => {
    const al = activeLessonRef.current;
    if (!al || !enrollmentId || !user?.id) return;
    await markLessonComplete(al.id, enrollmentId, user.id);
    invalidateProgress();
  }, [enrollmentId, user?.id, invalidateProgress]);

  if (!hasDirectusEnv()) {
    return <p className="p-6 text-sm text-amber-800">Set VITE_DIRECTUS_URL.</p>;
  }

  if (!user) {
    return (
      <div className="p-6">
        <Link to="/login" className="text-indigo-600">
          Log in
        </Link>{' '}
        to view this course.
      </div>
    );
  }

  if (courseQ.isLoading || enrollQ.isLoading) {
    return <div className="p-6 text-sm text-slate-600">Loading course…</div>;
  }

  if (!course || !rawCourse) {
    return <div className="p-6 text-sm text-rose-700">Course not found.</div>;
  }

  if (!enrollment) {
    return null;
  }

  const coursePick = {
    title: course.title,
    slug: course.slug,
    default_completion_threshold: course.default_completion_threshold,
    default_video_player_theme: course.default_video_player_theme,
  };

  const pct = Math.min(100, Math.max(0, Number(enrollment.progress_pct ?? 0)));
  const idx = activeLessonId ? lessons.findIndex((l) => l.id === activeLessonId) : 0;
  const prevL = idx > 0 ? lessons[idx - 1] : null;
  const nextL = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1]! : null;
  const nextTitle = nextL?.title ?? null;

  const rowForLesson = activeLesson ? byLesson.get(activeLesson.id) : undefined;
  const initialPos = Number(rowForLesson?.last_position_seconds ?? 0);

  const transcript = activeLesson?.video_transcript?.trim() ?? '';
  const transcriptLines = transcript ? transcript.split('\n') : [];
  const activeLine = transcriptActiveLineIndex(transcriptLines, playheadSec);
  const chapters = activeLesson ? parseChapters(activeLesson.video_chapters) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
        <Link
          to="/my/learning"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{course.title}</p>
          <div className="mt-1 max-w-md">
            <ProgressBar value={pct} size="sm" />
          </div>
        </div>
        <button
          type="button"
          className="hidden rounded-lg border border-slate-200 p-2 text-slate-600 lg:inline-flex"
          aria-label={leftOpen ? 'Hide curriculum' : 'Show curriculum'}
          onClick={() => setLeftOpen((v) => !v)}
        >
          {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className="hidden rounded-lg border border-slate-200 p-2 text-slate-600 lg:inline-flex"
          aria-label={rightOpen ? 'Hide side panel' : 'Show side panel'}
          onClick={() => setRightOpen((v) => !v)}
        >
          {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {leftOpen ? (
          <aside className="sticky top-[52px] hidden h-[calc(100vh-52px)] w-[320px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 lg:block">
            <CurriculumOutline
              course={course}
              variant="player"
              progress={progress}
              currentLessonId={activeLessonId ?? undefined}
              overallProgressPct={pct}
              onLessonClick={(id) => setActiveLessonId(id)}
            />
          </aside>
        ) : null}

        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
          {!activeLesson ? (
            <p className="text-sm text-slate-600">No lessons in this course.</p>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              <h1 className="text-xl font-bold text-slate-900">{activeLesson.title}</h1>

              {activeLesson.lesson_type === 'video' && (
                <VideoPlayer
                  key={activeLesson.id}
                  lesson={activeLesson}
                  course={coursePick}
                  initialPosition={initialPos}
                  onProgress={videoProgressHandler}
                  onPlayheadSeconds={setPlayheadSec}
                  onComplete={videoCompleteHandler}
                  seekRequest={seekRequest}
                  autoPlayNext={() => nextL && setActiveLessonId(nextL.id)}
                  nextLessonTitle={nextTitle}
                />
              )}

              {activeLesson.lesson_type === 'text' && (
                <>
                  <RichText content={activeLesson.text_body ?? ''} />
                  <button
                    type="button"
                    disabled={completeMut.isPending || progress[activeLesson.id] === 'completed'}
                    onClick={() => completeMut.mutate(activeLesson.id)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Mark as complete
                  </button>
                </>
              )}

              {activeLesson.lesson_type === 'pdf' && (
                <>
                  {(() => {
                    const url = directusAssetUrl(activeLesson.pdf_file);
                    return url ? <PdfViewer fileUrl={url} className="min-h-[480px]" /> : <p className="text-sm text-slate-600">No PDF file.</p>;
                  })()}
                  <button
                    type="button"
                    disabled={completeMut.isPending || progress[activeLesson.id] === 'completed'}
                    onClick={() => completeMut.mutate(activeLesson.id)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Mark as complete
                  </button>
                </>
              )}

              {activeLesson.lesson_type === 'quiz' && (() => {
                const qz = activeQuiz;
                if (!qz)
                  return <p className="text-sm text-amber-800">This quiz lesson is not linked to a quiz yet.</p>;
                const attempts = quizAttemptsQ.data ?? [];
                const maxAttempts = qz.max_attempts == null ? null : Number(qz.max_attempts);
                const attemptsUsed = attempts.length;
                const maxReached = maxAttempts != null && Number.isFinite(maxAttempts) && attemptsUsed >= maxAttempts;
                const inProgress = attempts.find((a) => a.status === 'in_progress');
                return (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">{qz.title ?? 'Quiz'}</h2>
                    {qz.description ? (
                      <div className="prose prose-sm mt-2 max-w-none text-slate-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{qz.description}</ReactMarkdown>
                      </div>
                    ) : null}
                    <ul className="mt-3 space-y-1 text-sm text-slate-600">
                      <li>Time limit: {qz.time_limit_minutes != null ? `${qz.time_limit_minutes} min` : 'None'}</li>
                      <li>Max attempts: {qz.max_attempts != null ? qz.max_attempts : 'Unlimited'}</li>
                      <li>Passing score: {qz.passing_score ?? 70}%</li>
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {inProgress?.id ? (
                        <Link
                          to={`/quiz/${encodeURIComponent(String(inProgress.id))}`}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                          Resume quiz
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={quizStartMut.isPending || !enrollmentId || maxReached}
                          onClick={() => quizStartMut.mutate(qz.id)}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Start quiz
                        </button>
                      )}
                    </div>
                    {maxReached && !inProgress ? (
                      <p className="mt-3 text-sm text-amber-800">
                        You have used all {maxAttempts} allowed attempt{maxAttempts === 1 ? '' : 's'} for this quiz.
                      </p>
                    ) : null}
                  </div>
                );
              })()}

              {activeLesson.lesson_type === 'assignment' && (() => {
                const as = resolveAssignment(activeLesson);
                if (!as)
                  return (
                    <p className="text-sm text-amber-800">This assignment lesson is not linked to an assignment yet.</p>
                  );
                return (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">{as.title ?? 'Assignment'}</h2>
                    {as.description ? (
                      <div className="prose prose-sm mt-2 max-w-none text-slate-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{as.description}</ReactMarkdown>
                      </div>
                    ) : null}
                    {as.instructions ? (
                      <div className="prose prose-sm mt-3 max-w-none text-slate-700">
                        <p className="text-xs font-semibold uppercase text-slate-500">Instructions</p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{as.instructions}</ReactMarkdown>
                      </div>
                    ) : null}
                    <ul className="mt-3 text-sm text-slate-600">
                      {as.due_date ? <li>Due: {new Date(as.due_date).toLocaleString()}</li> : null}
                      <li>Max points: {as.max_points ?? '—'}</li>
                    </ul>
                    <Link
                      to={`/assignment/${encodeURIComponent(as.id)}`}
                      className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Submit assignment
                    </Link>
                  </div>
                );
              })()}

              {activeLesson.lesson_type === 'external_link' && (() => {
                const url = activeLesson.external_url?.trim() ?? '';
                if (!url) return <p className="text-sm text-slate-600">No URL configured.</p>;
                const embed = activeLesson.allow_embed === true;
                return (
                  <div className="space-y-3">
                    {embed ? (
                      <iframe title="External content" src={url} className="h-[560px] w-full rounded-xl border border-slate-200 bg-white" />
                    ) : null}
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      Open in new tab
                    </a>
                  </div>
                );
              })()}
            </div>
          )}
        </main>

        {rightOpen ? (
          <aside className="sticky top-[52px] hidden h-[calc(100vh-52px)] w-[300px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-3 lg:block">
            <div className="flex gap-1 border-b border-slate-200 pb-2">
              {(['transcript', 'chapters', 'resources'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRightTab(t)}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize',
                    rightTab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-3 text-sm">
              {rightTab === 'transcript' ? (
                transcript ? (
                  <div className="space-y-1">
                    {transcriptLines.map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          'rounded-md px-2 py-1 text-xs leading-relaxed',
                          i === activeLine ? 'bg-amber-100 text-amber-950' : 'text-slate-700',
                        )}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{line || ' '}</ReactMarkdown>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No transcript for this lesson.</p>
                )
              ) : null}
              {rightTab === 'chapters' ? (
                chapters.length ? (
                  <ul className="space-y-1">
                    {chapters.map((ch) => (
                      <li key={`${ch.start}-${ch.title}`}>
                        <button
                          type="button"
                          className="w-full rounded-md px-2 py-2 text-left text-xs text-slate-800 hover:bg-slate-100"
                          onClick={() => seekToSeconds(ch.start)}
                        >
                          <span className="font-mono text-slate-500">{Math.floor(ch.start / 60)}:{String(ch.start % 60).padStart(2, '0')}</span>{' '}
                          {ch.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500">No chapters.</p>
                )
              ) : null}
              {rightTab === 'resources' ? (
                <ul className="space-y-2">
                  {(resourcesQ.data as UnknownRecord[] | undefined)?.map((r) => {
                    const fileUrl = directusAssetUrl(r.file as string | { id: string } | null | undefined);
                    const ext = r.external_url != null ? String(r.external_url) : '';
                    const title = String(r.title ?? 'Resource');
                    return (
                      <li key={String(r.id)}>
                        {fileUrl ? (
                          <a href={fileUrl} download className="block text-xs font-medium text-indigo-600 hover:underline">
                            {title} (download)
                          </a>
                        ) : null}
                        {ext ? (
                          <a href={ext} target="_blank" rel="noreferrer" className="block text-xs font-medium text-indigo-600 hover:underline">
                            {title} (link)
                          </a>
                        ) : null}
                        {!fileUrl && !ext ? <span className="text-xs text-slate-500">{title}</span> : null}
                      </li>
                    );
                  })}
                  {resourcesQ.isSuccess && (!(resourcesQ.data as UnknownRecord[])?.length) ? (
                    <p className="text-slate-500">No resources.</p>
                  ) : null}
                </ul>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      <footer className="sticky bottom-0 z-40 flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
        <button
          type="button"
          disabled={!prevL}
          onClick={() => prevL && setActiveLessonId(prevL.id)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-slate-900">{activeLesson?.title}</p>
        <button
          type="button"
          disabled={!nextL}
          onClick={() => nextL && setActiveLessonId(nextL.id)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </footer>
    </div>
  );
}
