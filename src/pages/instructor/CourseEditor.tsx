import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  createAnnouncement,
  createAssignmentShell,
  createLesson,
  createModule,
  createQuizShell,
  deleteLesson,
  fetchAnnouncementsForCourse,
  fetchAssignmentForEditor,
  fetchCourseForEditor,
  fetchCourseTags,
  fetchCoursesForPrerequisitePicker,
  fetchInstructorsForCoPicker,
  updateCourse,
  updateLesson,
  updateModule,
} from '@/api/instructor';
import { parseLearningObjectives, mapToCourseWithCurriculum } from '@/lib/map-entities';
import { slugifyTitle } from '@/lib/slugify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { hasDirectusEnv } from '@/lib/directus';
import { InstructorGate } from '@/components/instructor/InstructorGate';
import { CurriculumOutline } from '@/components/courses/CurriculumOutline';
import { RichTextEditor } from '@/components/content/RichTextEditor';
import { TagPicker } from '@/components/instructor/TagPicker';
import { VideoLessonFields } from '@/components/instructor/VideoLessonFields';
import { AssignmentEditor } from '@/components/instructor/AssignmentEditor';
import { directusAssetUrl } from '@/lib/assets';
import type { UnknownRecord } from '@/api/public';
import type { Lesson } from '@/types/lms';

type Tab = 'details' | 'curriculum' | 'pricing' | 'settings' | 'announcements';

export default function CourseEditor() {
  const { id: courseId } = useParams<{ id: string }>();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('details');
  const [lessonDialog, setLessonDialog] = useState<{ moduleId: string } | null>(null);
  const [newLessonType, setNewLessonType] = useState('video');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [drawerLessonId, setDrawerLessonId] = useState<string | null>(null);
  const [lessonPatch, setLessonPatch] = useState<UnknownRecord>({});
  const [assignEditorId, setAssignEditorId] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const courseQ = useQuery({
    queryKey: ['instructor-course', courseId],
    enabled: hasDirectusEnv() && Boolean(courseId),
    queryFn: () => fetchCourseForEditor(courseId!),
  });

  const raw = courseQ.data as UnknownRecord | undefined;
  const courseWC = useMemo(() => (raw ? mapToCourseWithCurriculum(raw) : null), [raw]);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [trailer, setTrailer] = useState('');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [language, setLanguage] = useState('English');
  const [durationOverride, setDurationOverride] = useState<number | ''>('');
  const [defThreshold, setDefThreshold] = useState(90);
  const [defTheme, setDefTheme] = useState<'light' | 'dark'>('light');
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [enrollLimit, setEnrollLimit] = useState<number | ''>('');
  const [enrollDeadline, setEnrollDeadline] = useState('');
  const [selfPaced, setSelfPaced] = useState(true);
  const [passingScore, setPassingScore] = useState(70);
  const [status, setStatus] = useState('Draft');
  const [visibility, setVisibility] = useState('Public');
  const [coIds, setCoIds] = useState<string[]>([]);
  const [preIds, setPreIds] = useState<string[]>([]);

  useEffect(() => {
    if (!raw) return;
    setTitle(String(raw.title ?? ''));
    setSlug(String(raw.slug ?? ''));
    setSubtitle(String(raw.subtitle ?? ''));
    setDescription(String(raw.description ?? ''));
    setObjectives(parseLearningObjectives(raw.learning_objectives));
    const cat = raw.category as UnknownRecord | undefined;
    setCategoryId(cat?.id ? String(cat.id) : '');
    const tagRows = (raw.tags as UnknownRecord[] | undefined) ?? [];
    setTagIds(tagRows.map((t) => String((t as { course_tags_id?: { id?: string } }).course_tags_id?.id ?? t.id ?? '')).filter(Boolean));
    const ci = raw.cover_image;
    setCoverId(typeof ci === 'object' && ci && 'id' in ci ? String((ci as { id: string }).id) : typeof ci === 'string' ? ci : null);
    setTrailer(String(raw.trailer_video_url ?? ''));
    setDifficulty(String(raw.difficulty ?? 'Beginner'));
    setLanguage(String(raw.language ?? 'English'));
    setDurationOverride(raw.duration_minutes != null ? Number(raw.duration_minutes) : '');
    setDefThreshold(Number(raw.default_completion_threshold ?? 90));
    setDefTheme((raw.default_video_player_theme as 'light' | 'dark') || 'light');
    setIsFree(Boolean(raw.is_free));
    setPrice(Number(raw.price ?? 0));
    setCurrency(String(raw.currency ?? 'USD'));
    setEnrollLimit(raw.enrollment_limit != null ? Number(raw.enrollment_limit) : '');
    setEnrollDeadline(raw.enrollment_deadline ? String(raw.enrollment_deadline).slice(0, 16) : '');
    setSelfPaced(Boolean(raw.self_paced ?? true));
    setPassingScore(Number(raw.passing_score ?? 70));
    setStatus(String(raw.status ?? 'Draft'));
    setVisibility(String(raw.visibility ?? 'Public'));
    const cos = (raw.co_instructors as UnknownRecord[] | undefined) ?? [];
    setCoIds(cos.map((j) => String((j as { directus_users_id?: { id?: string } }).directus_users_id?.id ?? '')).filter(Boolean));
    const pres = (raw.prerequisites as UnknownRecord[] | undefined) ?? [];
    setPreIds(pres.map((j) => String((j as { courses_id?: { id?: string } }).courses_id?.id ?? '')).filter(Boolean));
  }, [raw]);

  const computedDuration = useMemo(() => {
    if (!courseWC?.modules) return 0;
    let m = 0;
    for (const mod of courseWC.modules) for (const l of mod.lessons ?? []) m += Number(l.duration_minutes ?? 0);
    return m;
  }, [courseWC]);

  const tagsQ = useQuery({ queryKey: ['course-tags'], queryFn: fetchCourseTags, enabled: hasDirectusEnv() && tab === 'details' });
  const instQ = useQuery({
    queryKey: ['co-instructors-pick', user?.id],
    queryFn: () => fetchInstructorsForCoPicker(user!.id),
    enabled: hasDirectusEnv() && Boolean(user?.id) && tab === 'settings',
  });
  const preQ = useQuery({
    queryKey: ['prereq-pick', courseId],
    queryFn: () => fetchCoursesForPrerequisitePicker(courseId!),
    enabled: hasDirectusEnv() && Boolean(courseId) && tab === 'settings',
  });
  const annQ = useQuery({
    queryKey: ['course-announcements', courseId],
    queryFn: () => fetchAnnouncementsForCourse(courseId!),
    enabled: hasDirectusEnv() && Boolean(courseId) && tab === 'announcements',
  });

  const saveDetails = useCallback(async () => {
    if (!courseId) return;
    const body: UnknownRecord = {
      title,
      slug,
      subtitle,
      description,
      learning_objectives: JSON.stringify(objectives.filter(Boolean)),
      category: categoryId || null,
      trailer_video_url: trailer || null,
      difficulty,
      language,
      duration_minutes: durationOverride === '' ? computedDuration || null : Number(durationOverride),
      default_completion_threshold: defThreshold,
      default_video_player_theme: defTheme,
      cover_image: coverId,
      tags: tagIds,
    };
    await updateCourse(courseId, body);
    void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] });
  }, [
    courseId,
    title,
    slug,
    subtitle,
    description,
    objectives,
    categoryId,
    trailer,
    difficulty,
    language,
    durationOverride,
    computedDuration,
    defThreshold,
    defTheme,
    coverId,
    tagIds,
    qc,
  ]);

  useEffect(() => {
    if (tab !== 'details') return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void saveDetails().catch(() => {});
    }, 5000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [tab, saveDetails, title, slug, subtitle, description, objectives, categoryId, trailer, tagIds, defThreshold, defTheme, durationOverride, coverId]);

  const paidCourse = !isFree && Number(price) > 0;

  const selectedLesson: Lesson | null = useMemo(() => {
    if (!drawerLessonId || !courseWC?.modules) return null;
    for (const m of courseWC.modules) {
      const hit = (m.lessons ?? []).find((l) => l.id === drawerLessonId);
      if (hit) return { ...hit, ...lessonPatch } as Lesson;
    }
    return null;
  }, [drawerLessonId, courseWC, lessonPatch]);

  const assignQ = useQuery({
    queryKey: ['assignment-editor', assignEditorId],
    enabled: Boolean(assignEditorId),
    queryFn: () => fetchAssignmentForEditor(assignEditorId!),
  });

  const mergeLesson = (p: UnknownRecord) => setLessonPatch((prev) => ({ ...prev, ...p }));

  async function persistLesson() {
    if (!drawerLessonId) return;
    await updateLesson(drawerLessonId, lessonPatch);
    setLessonPatch({});
    setDrawerLessonId(null);
    void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] });
  }

  async function handleReorderModules(ids: string[]) {
    await Promise.all(ids.map((mid, i) => updateModule(mid, { sort_order: i })));
    void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] });
  }

  async function handleReorderLessons(moduleId: string, orderedIds: string[]) {
    await Promise.all(orderedIds.map((lid, i) => updateLesson(lid, { sort_order: i, module: moduleId })));
    void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] });
  }

  const addModuleMut = useMutation({
    mutationFn: async () => {
      const mods = courseWC?.modules ?? [];
      const next = mods.length ? Math.max(...mods.map((m) => Number(m.sort_order ?? 0))) + 1 : 0;
      await createModule(courseId!, 'New module', next);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] }),
  });

  const addLessonMut = useMutation({
    mutationFn: async () => {
      if (!lessonDialog) return;
      const mod = courseWC?.modules?.find((m) => m.id === lessonDialog.moduleId);
      const n = (mod?.lessons ?? []).length;
      const titleBase = newLessonTitle.trim() || 'Untitled lesson';
      let quizId: string | undefined;
      let assignId: string | undefined;
      if (newLessonType === 'quiz') {
        const qz = await createQuizShell(courseId!, titleBase);
        quizId = String((qz as UnknownRecord).id);
      }
      if (newLessonType === 'assignment') {
        const as = await createAssignmentShell(courseId!, titleBase);
        assignId = String((as as UnknownRecord).id);
      }
      await createLesson({
        module: lessonDialog.moduleId,
        title: titleBase,
        lesson_type: newLessonType,
        sort_order: n,
        duration_minutes: 5,
        required: true,
        completion_criteria: newLessonType === 'quiz' ? 'quiz_passed' : newLessonType === 'assignment' ? 'submission_accepted' : 'view',
        is_preview: false,
        text_body: newLessonType === 'text' ? '<p></p>' : null,
        ...(quizId ? { quiz: quizId } : {}),
        ...(assignId ? { assignment: assignId } : {}),
      });
    },
    onSuccess: () => {
      setLessonDialog(null);
      setNewLessonTitle('');
      void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] });
    },
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      if (!courseId) return;
      if (!title.trim() || !slug.trim() || !categoryId) throw new Error('Title, slug, and category are required.');
      if (!(courseWC?.modules ?? []).length) throw new Error('Add at least one module.');
      let lessons = 0;
      for (const m of courseWC?.modules ?? []) lessons += (m.lessons ?? []).length;
      if (!lessons) throw new Error('Add at least one lesson.');
      await updateCourse(courseId, { status: 'Published', published_at: new Date().toISOString() });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] }),
  });

  const annMut = useMutation({
    mutationFn: async (payload: UnknownRecord) => {
      if (!courseId || !user?.id) return;
      await createAnnouncement(courseId, user.id, payload);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['course-announcements', courseId] }),
  });

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  if (!courseWC || !raw) {
    return (
      <InstructorGate>
        <p className="p-8 text-sm text-slate-500">{courseQ.isLoading ? 'Loading course…' : 'Course not found.'}</p>
      </InstructorGate>
    );
  }

  const coverUrl = directusAssetUrl(coverId);

  return (
    <InstructorGate>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit course</h1>
            <p className="text-sm text-slate-600">{title}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50" to={`/instructor/courses/${encodeURIComponent(courseId!)}/students`}>
              Students
            </Link>
            <Link className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50" to={`/instructor/courses/${encodeURIComponent(courseId!)}/grading`}>
              Grading
            </Link>
            <Link className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50" to={`/instructor/courses/${encodeURIComponent(courseId!)}/analytics`}>
              Analytics
            </Link>
            <Link className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50" to="/instructor/courses">
              My courses
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {(
            [
              ['details', 'Details'],
              ['curriculum', 'Curriculum'],
              ['pricing', 'Pricing'],
              ['settings', 'Settings'],
              ['announcements', 'Announcements'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'details' ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium">Title</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slugTouched) setSlug(slugifyTitle(e.target.value));
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Slug</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Subtitle</span>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Description</span>
                <div className="mt-1 rounded-lg border border-slate-200">
                  <RichTextEditor value={description} onChange={setDescription} />
                </div>
              </label>
              <div>
                <span className="text-sm font-medium">Learning objectives</span>
                <ul className="mt-2 space-y-2">
                  {objectives.map((o, i) => (
                    <li key={i} className="flex gap-2">
                      <input className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm" value={o} onChange={(e) => setObjectives(objectives.map((x, j) => (j === i ? e.target.value : x)))} />
                      <button type="button" className="text-xs text-rose-600" onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="mt-2 text-xs text-indigo-600" onClick={() => setObjectives([...objectives, ''])}>
                  + Objective
                </button>
              </div>
              <label className="block text-sm">
                <span className="font-medium">Category ID</span>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
              </label>
              <div>
                <span className="text-sm font-medium">Tags</span>
                <div className="mt-2">
                  <TagPicker allTags={(tagsQ.data ?? []) as UnknownRecord[]} selectedIds={tagIds} onChange={setTagIds} />
                </div>
              </div>
              <label className="block text-sm">
                <span className="font-medium">Trailer video URL</span>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={trailer} onChange={(e) => setTrailer(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Difficulty
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    {['Beginner', 'Intermediate', 'Advanced', 'All Levels'].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Language
                  <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2" value={language} onChange={(e) => setLanguage(e.target.value)} />
                </label>
              </div>
              <p className="text-xs text-slate-500">Computed duration from lessons: {computedDuration} min</p>
              <label className="text-sm">
                Duration override (minutes)
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={durationOverride}
                  onChange={(e) => setDurationOverride(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label className="text-sm">
                Default completion threshold: {defThreshold}%
                <input type="range" min={50} max={100} className="mt-1 w-full" value={defThreshold} onChange={(e) => setDefThreshold(Number(e.target.value))} />
              </label>
              <label className="text-sm">
                Default video player theme
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2" value={defTheme} onChange={(e) => setDefTheme(e.target.value as 'light' | 'dark')}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className="block text-sm">
                Cover image (file id after upload in Directus)
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" value={coverId ?? ''} onChange={(e) => setCoverId(e.target.value || null)} />
                {coverUrl ? <img src={coverUrl} alt="" className="mt-2 max-h-40 rounded border border-slate-200" /> : null}
              </label>
              <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => void saveDetails()}>
                Save now
              </button>
              <p className="text-xs text-slate-500">Details autosave every 5 seconds while you are on this tab.</p>
            </div>
          </div>
        ) : null}

        {tab === 'curriculum' && courseWC ? (
          <div className="mt-6">
            <CurriculumOutline
              course={courseWC}
              variant="instructor-editor"
              onRenameModule={(mid, t) => void updateModule(mid, { title: t }).then(() => qc.invalidateQueries({ queryKey: ['instructor-course', courseId] }))}
              onRenameLesson={(lid, t) => void updateLesson(lid, { title: t }).then(() => qc.invalidateQueries({ queryKey: ['instructor-course', courseId] }))}
              onAddLesson={(mid) => setLessonDialog({ moduleId: mid })}
              onDeleteLesson={(lid) => {
                if (confirm('Delete this lesson?')) void deleteLesson(lid).then(() => qc.invalidateQueries({ queryKey: ['instructor-course', courseId] }));
              }}
              onAddModule={() => addModuleMut.mutate()}
              onReorderLessons={handleReorderLessons}
              onReorderModules={handleReorderModules}
              onInstructorEditLesson={(lid) => {
                setLessonPatch({});
                setDrawerLessonId(lid);
              }}
            />
          </div>
        ) : null}

        {tab === 'pricing' ? (
          <div className="mt-6 max-w-xl space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
              Free course
            </label>
            <label className="block text-sm">
              Price
              <input type="number" className="mt-1 w-full rounded border px-3 py-2" disabled={isFree} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </label>
            <label className="block text-sm">
              Currency
              <input className="mt-1 w-full rounded border px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </label>
            <label className="block text-sm">
              Enrollment limit
              <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={enrollLimit} onChange={(e) => setEnrollLimit(e.target.value === '' ? '' : Number(e.target.value))} />
            </label>
            <label className="block text-sm">
              Enrollment deadline
              <input type="datetime-local" className="mt-1 w-full rounded border px-3 py-2" value={enrollDeadline} onChange={(e) => setEnrollDeadline(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selfPaced} onChange={(e) => setSelfPaced(e.target.checked)} />
              Self-paced
            </label>
            <label className="block text-sm">
              Passing score
              <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} />
            </label>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
              onClick={() =>
                void updateCourse(courseId!, {
                  is_free: isFree,
                  price: isFree ? 0 : price,
                  currency,
                  enrollment_limit: enrollLimit === '' ? null : enrollLimit,
                  enrollment_deadline: enrollDeadline ? new Date(enrollDeadline).toISOString() : null,
                  self_paced: selfPaced,
                  passing_score: passingScore,
                }).then(() => qc.invalidateQueries({ queryKey: ['instructor-course', courseId] }))
              }
            >
              Save pricing
            </button>
          </div>
        ) : null}

        {tab === 'settings' ? (
          <div className="mt-6 max-w-2xl space-y-4">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-950">
              Certificates use the <strong>global template</strong> managed by admins in Directus (Certificate Templates). There is no per-course template picker here.
            </div>
            <label className="block text-sm">
              Status
              <select className="mt-1 w-full rounded border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                {['Draft', 'Published', 'Archived'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Visibility
              <select className="mt-1 w-full rounded border px-3 py-2" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                {['Public', 'Unlisted'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-sm font-medium">Co-instructors</span>
              <select multiple className="mt-1 h-32 w-full rounded border px-2 py-1 text-sm" value={coIds} onChange={(e) => setCoIds([...e.target.selectedOptions].map((o) => o.value))}>
                {(instQ.data ?? []).map((u: UnknownRecord) => (
                  <option key={String(u.id)} value={String(u.id)}>
                    {String(u.first_name)} {String(u.last_name)} ({String(u.email)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-sm font-medium">Prerequisites</span>
              <select multiple className="mt-1 h-32 w-full rounded border px-2 py-1 text-sm" value={preIds} onChange={(e) => setPreIds([...e.target.selectedOptions].map((o) => o.value))}>
                {(preQ.data ?? []).map((c: UnknownRecord) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.title)} ({String(c.status)})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
              onClick={() =>
                void updateCourse(courseId!, {
                  status,
                  visibility,
                  co_instructors: coIds,
                  prerequisites: preIds,
                }).then(() => qc.invalidateQueries({ queryKey: ['instructor-course', courseId] }))
              }
            >
              Save settings
            </button>
            <button
              type="button"
              className="ml-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900"
              onClick={() => publishMut.mutate()}
              disabled={publishMut.isPending}
            >
              {publishMut.isPending ? 'Publishing…' : 'Publish (validate)'}
            </button>
            {publishMut.isError ? <p className="text-sm text-rose-600">{(publishMut.error as Error).message}</p> : null}
          </div>
        ) : null}

        {tab === 'announcements' ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-semibold text-slate-900">Existing</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {(annQ.data ?? []).map((a: UnknownRecord) => (
                  <li key={String(a.id)} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-medium">{String(a.title)}</p>
                    <p className="text-xs text-slate-500">{a.published_at ? format(new Date(String(a.published_at)), 'PPp') : ''}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">New announcement</h2>
              <input className="mt-2 w-full rounded border px-3 py-2 text-sm" placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
              <div className="mt-2 rounded border">
                <RichTextEditor value={annBody} onChange={setAnnBody} />
              </div>
              <button type="button" className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" onClick={() => annMut.mutate({ title: annTitle, body: annBody, is_pinned: false })}>
                Post
              </button>
            </div>
          </div>
        ) : null}

        {lessonDialog ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold">Add lesson</h2>
              <label className="mt-4 block text-sm">
                Type
                <select className="mt-1 w-full rounded border px-3 py-2" value={newLessonType} onChange={(e) => setNewLessonType(e.target.value)}>
                  {['video', 'text', 'pdf', 'quiz', 'assignment', 'external_link'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm">
                Title
                <input className="mt-1 w-full rounded border px-3 py-2" value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} />
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setLessonDialog(null)}>
                  Cancel
                </button>
                <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" onClick={() => addLessonMut.mutate()}>
                  Create
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {drawerLessonId && selectedLesson ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="h-full w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Lesson</h2>
                <button type="button" className="text-sm text-slate-600" onClick={() => setDrawerLessonId(null)}>
                  Close
                </button>
              </div>
              <label className="mt-4 block text-sm">
                Title
                <input className="mt-1 w-full rounded border px-3 py-2" defaultValue={selectedLesson.title} onBlur={(e) => mergeLesson({ title: e.target.value })} />
              </label>
              <label className="mt-3 block text-sm">
                Type
                <input className="mt-1 w-full rounded border bg-slate-50 px-3 py-2 text-slate-600" readOnly value={selectedLesson.lesson_type} />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={paidCourse}
                  title={paidCourse ? 'Only free courses may offer preview lessons.' : undefined}
                  checked={Boolean(lessonPatch.is_preview ?? selectedLesson.is_preview)}
                  onChange={(e) => mergeLesson({ is_preview: e.target.checked })}
                />
                Preview lesson
              </label>
              {selectedLesson.lesson_type === 'video' ? (
                <div className="mt-4" key={drawerLessonId}>
                  <VideoLessonFields lesson={selectedLesson} courseDefaultThreshold={defThreshold} paidCourse={paidCourse} onPatch={mergeLesson} />
                </div>
              ) : null}
              {selectedLesson.lesson_type === 'text' ? (
                <div className="mt-4 rounded border">
                  <RichTextEditor value={String(lessonPatch.text_body ?? selectedLesson.text_body ?? '')} onChange={(html) => mergeLesson({ text_body: html })} />
                </div>
              ) : null}
              {selectedLesson.lesson_type === 'pdf' ? (
                <label className="mt-4 block text-sm">
                  PDF file id
                  <input className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs" defaultValue={typeof selectedLesson.pdf_file === 'object' && selectedLesson.pdf_file && 'id' in selectedLesson.pdf_file ? (selectedLesson.pdf_file as { id: string }).id : String(selectedLesson.pdf_file ?? '')} onBlur={(e) => mergeLesson({ pdf_file: e.target.value || null })} />
                </label>
              ) : null}
              {selectedLesson.lesson_type === 'external_link' ? (
                <label className="mt-4 block text-sm">
                  External URL
                  <input className="mt-1 w-full rounded border px-3 py-2" defaultValue={selectedLesson.external_url ?? ''} onBlur={(e) => mergeLesson({ external_url: e.target.value })} />
                </label>
              ) : null}
              {selectedLesson.lesson_type === 'quiz' ? (
                <div className="mt-4 space-y-2 text-sm">
                  <p>Linked quiz: {typeof selectedLesson.quiz === 'object' && selectedLesson.quiz && 'id' in selectedLesson.quiz ? String((selectedLesson.quiz as { id: string }).id) : String(selectedLesson.quiz ?? '—')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white"
                      to={`/instructor/courses/${encodeURIComponent(courseId!)}/quizzes/${encodeURIComponent(String((selectedLesson.quiz as { id?: string })?.id ?? ''))}/edit`}
                    >
                      Open quiz editor
                    </Link>
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5"
                      onClick={async () => {
                        const qn = await createQuizShell(courseId!, `Quiz for ${selectedLesson.title}`);
                        await updateLesson(drawerLessonId, { quiz: String((qn as UnknownRecord).id) });
                        void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] });
                      }}
                    >
                      Create & link new quiz
                    </button>
                  </div>
                </div>
              ) : null}
              {selectedLesson.lesson_type === 'assignment' ? (
                <div className="mt-4 space-y-2 text-sm">
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5"
                    onClick={() => {
                      const aid =
                        typeof selectedLesson.assignment === 'object' && selectedLesson.assignment && 'id' in selectedLesson.assignment
                          ? String((selectedLesson.assignment as { id: string }).id)
                          : null;
                      if (aid) setAssignEditorId(aid);
                    }}
                  >
                    Edit linked assignment
                  </button>
                  <button
                    type="button"
                    className="ml-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-white"
                    onClick={async () => {
                      const an = await createAssignmentShell(courseId!, `Assignment: ${selectedLesson.title}`);
                      await updateLesson(drawerLessonId, { assignment: String((an as UnknownRecord).id) });
                      void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] });
                    }}
                  >
                    Create & link assignment
                  </button>
                </div>
              ) : null}
              <div className="mt-8 flex justify-end gap-2">
                <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" onClick={() => void persistLesson()}>
                  Save lesson
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {assignEditorId && assignQ.data ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
              <div className="flex justify-between gap-2">
                <h2 className="text-lg font-semibold">Assignment</h2>
                <button type="button" onClick={() => setAssignEditorId(null)}>
                  Close
                </button>
              </div>
              <AssignmentEditor
                assignment={assignQ.data}
                onSaved={() => {
                  setAssignEditorId(null);
                  void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] });
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </InstructorGate>
  );
}
