import { aggregate, createItem, deleteItem, readItem, readItems, updateItem, uploadFiles } from '@directus/sdk';
import { directus, hasDirectusEnv } from '@/lib/directus';
import type { UnknownRecord } from '@/api/public';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ri = readItems as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rone = readItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ci = createItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ui = updateItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const di = deleteItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const aggQuery = aggregate as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const uf = uploadFiles as any;

function assertUrl() {
  if (!hasDirectusEnv()) throw new Error('VITE_DIRECTUS_URL is not set');
}

/** Courses where the user is primary instructor or co-instructor. */
export function instructorScope(userId: string): UnknownRecord {
  return {
    _or: [
      { instructor: { _eq: userId } },
      { co_instructors: { directus_users_id: { _eq: userId } } } as UnknownRecord,
    ],
  };
}

export async function fetchMyInstructorCourseIds(userId: string): Promise<string[]> {
  assertUrl();
  try {
    const rows = (await directus.request(
      ri('courses', {
        filter: instructorScope(userId),
        fields: ['id'],
        limit: -1,
      }),
    )) as UnknownRecord[];
    return rows.map((r) => String(r.id));
  } catch {
    const rows = (await directus.request(
      ri('courses', {
        filter: { instructor: { _eq: userId } },
        fields: ['id'],
        limit: -1,
      }),
    )) as UnknownRecord[];
    return rows.map((r) => String(r.id));
  }
}

export async function fetchInstructorDashboard(userId: string) {
  assertUrl();
  const scope = instructorScope(userId);
  const courseIds = await fetchMyInstructorCourseIds(userId);
  if (!courseIds.length) {
    return {
      totalStudents: 0,
      publishedCount: 0,
      pendingGrading: 0,
      recentEnrollments: [] as UnknownRecord[],
      revenuePlaceholder: 0,
      avgRating: 0,
      announcements: [] as UnknownRecord[],
      firstGradingCourseId: null as string | null,
    };
  }

  const courseFilter = { course: { _in: courseIds } };

  const [enrollAgg, publishedAgg, submissionsPending, essayPending, recentEnrollments, coursesForMetrics, announcements] =
    await Promise.all([
      directus
        .request(
          aggQuery('enrollments', {
            aggregate: { countDistinct: 'user' },
            query: { filter: courseFilter },
          }),
        )
        .catch(() => [{ countDistinct: { user: 0 } }]),
      directus
        .request(
          aggQuery('courses', {
            aggregate: { count: '*' },
            query: { filter: { _and: [scope, { status: { _eq: 'Published' } }] } },
          }),
        )
        .catch(() => [{ count: 0 }]),
      directus
        .request(
          aggQuery('submissions', {
            aggregate: { count: '*' },
            query: {
              filter: {
                _and: [
                  { status: { _eq: 'submitted' } },
                  { assignment: { course: { _in: courseIds } } },
                ],
              },
            },
          }),
        )
        .catch(() => [{ count: 0 }]),
      directus
        .request(
          aggQuery('quiz_responses', {
            aggregate: { count: '*' },
            query: {
              filter: {
                _and: [
                  { question: { question_type: { _in: ['essay', 'short_answer'] } } },
                  {
                    _or: [{ graded_by: { _null: true } }, { is_correct: { _null: true } }],
                  },
                  { attempt: { quiz: { course: { _in: courseIds } } } },
                ],
              },
            },
          }),
        )
        .catch(() => [{ count: 0 }]),
      directus.request(
        ri('enrollments', {
          filter: courseFilter,
          sort: ['-date_created'],
          limit: 10,
          fields: [
            'id',
            'enrolled_at',
            'date_created',
            'user.id',
            'user.first_name',
            'user.last_name',
            'user.email',
            'user.avatar',
            'course.id',
            'course.title',
            'course.slug',
          ],
        }),
      ) as Promise<UnknownRecord[]>,
      directus.request(
        ri('courses', {
          filter: scope,
          limit: -1,
          fields: ['id', 'enrollment_count', 'price', 'currency', 'average_rating'],
        }),
      ) as Promise<UnknownRecord[]>,
      directus.request(
        ri('announcements', {
          filter: { _and: [{ author: { _eq: userId } }, { course: { _null: false } }] },
          sort: ['-published_at'],
          limit: 8,
          fields: ['id', 'title', 'body', 'published_at', 'course.id', 'course.title', 'course.slug'],
        }),
      ) as Promise<UnknownRecord[]>,
    ]);

  const enrollRow = (enrollAgg as UnknownRecord[])?.[0];
  const countDistinct = enrollRow?.countDistinct as unknown;
  const totalStudents = Number(
    countDistinct != null && typeof countDistinct === 'object' && 'user' in countDistinct
      ? (countDistinct as { user: unknown }).user
      : (countDistinct as number | undefined) ?? 0,
  );
  const publishedCount = Number((publishedAgg as UnknownRecord[])?.[0]?.count ?? 0);
  const subP = Number((submissionsPending as UnknownRecord[])?.[0]?.count ?? 0);
  const essP = Number((essayPending as UnknownRecord[])?.[0]?.count ?? 0);
  const pendingGrading = subP + essP;

  let revenuePlaceholder = 0;
  let avgRating = 0;
  let n = 0;
  for (const c of coursesForMetrics) {
    const ec = Number(c.enrollment_count ?? 0);
    const p = Number(c.price ?? 0);
    revenuePlaceholder += ec * p;
    const ar = Number(c.average_rating ?? 0);
    if (ar > 0) {
      avgRating += ar;
      n += 1;
    }
  }
  if (n) avgRating /= n;

  return {
    totalStudents: Number.isFinite(totalStudents) ? totalStudents : 0,
    publishedCount: Number.isFinite(publishedCount) ? publishedCount : 0,
    pendingGrading: Number.isFinite(pendingGrading) ? pendingGrading : 0,
    recentEnrollments,
    revenuePlaceholder,
    avgRating: n ? avgRating : 0,
    announcements,
    firstGradingCourseId: courseIds[0] ?? null,
  };
}

export type InstructorCourseTab = 'all' | 'published' | 'draft' | 'archived';

export async function fetchMyInstructorCourses(userId: string, tab: InstructorCourseTab) {
  assertUrl();
  const parts: UnknownRecord[] = [instructorScope(userId)];
  if (tab === 'published') parts.push({ status: { _eq: 'Published' } });
  if (tab === 'draft') parts.push({ status: { _eq: 'Draft' } });
  if (tab === 'archived') parts.push({ status: { _eq: 'Archived' } });
  const filter = parts.length > 1 ? { _and: parts } : parts[0];
  return directus.request(
    ri('courses', {
      filter,
      sort: ['-date_updated'],
      limit: -1,
      fields: [
        'id',
        'title',
        'slug',
        'status',
        'published_at',
        'enrollment_count',
        'completion_count',
        'average_rating',
        'rating_count',
        'price',
        'currency',
        'is_free',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function createInstructorCourseDraft(params: { title: string; categoryId: string; instructorId: string }) {
  assertUrl();
  const { slugifyTitle } = await import('@/lib/slugify');
  const base = slugifyTitle(params.title);
  let slug = base;
  let n = 0;
  while (n < 50) {
    const existing = (await directus.request(
      ri('courses', { filter: { slug: { _eq: slug } }, limit: 1, fields: ['id'] }),
    )) as UnknownRecord[];
    if (!existing.length) break;
    n += 1;
    slug = `${base}-${n}`;
  }
  return directus.request(
    ci('courses', {
      title: params.title,
      slug,
      category: params.categoryId,
      instructor: params.instructorId,
      status: 'Draft',
      visibility: 'Public',
      is_free: true,
      price: 0,
      currency: 'USD',
      description: '',
      subtitle: '',
      learning_objectives: JSON.stringify([]),
      self_paced: true,
      passing_score: 70,
      default_completion_threshold: 90,
      default_video_player_theme: 'light',
    }),
  ) as Promise<UnknownRecord>;
}

export async function archiveCourse(courseId: string) {
  assertUrl();
  return directus.request(ui('courses', courseId, { status: 'Archived' })) as Promise<UnknownRecord>;
}

export async function duplicateCourse(courseId: string, instructorId: string) {
  assertUrl();
  const src = (await directus.request(
    rone('courses', courseId, {
      fields: [
        'title',
        'subtitle',
        'description',
        'learning_objectives',
        'category',
        'difficulty',
        'language',
        'is_free',
        'price',
        'currency',
        'trailer_video_url',
        'has_certificate',
        'modules.id',
        'modules.title',
        'modules.description',
        'modules.sort_order',
        'modules.lessons.id',
        'modules.lessons.title',
        'modules.lessons.lesson_type',
        'modules.lessons.sort_order',
        'modules.lessons.duration_minutes',
        'modules.lessons.is_preview',
        'modules.lessons.required',
        'modules.lessons.completion_criteria',
        'modules.lessons.video_source',
        'modules.lessons.video_youtube_id',
        'modules.lessons.video_vimeo_id',
        'modules.lessons.video_file',
        'modules.lessons.video_url',
        'modules.lessons.video_duration_seconds',
        'modules.lessons.video_chapters',
        'modules.lessons.video_transcript',
        'modules.lessons.text_body',
        'modules.lessons.pdf_file',
        'modules.lessons.external_url',
        'modules.lessons.quiz',
        'modules.lessons.assignment',
      ],
    }),
  )) as UnknownRecord;

  const { slugifyTitle } = await import('@/lib/slugify');
  const title = `Copy of ${String(src.title ?? 'Course')}`;
  let slug = slugifyTitle(title);
  let i = 0;
  while (i < 50) {
    const ex = (await directus.request(ri('courses', { filter: { slug: { _eq: slug } }, limit: 1, fields: ['id'] }))) as UnknownRecord[];
    if (!ex.length) break;
    i += 1;
    slug = `${slugifyTitle(title)}-${i}`;
  }

  const cat = typeof src.category === 'object' && src.category && 'id' in (src.category as object) ? (src.category as { id: string }).id : src.category;

  const newCourse = (await directus.request(
    ci('courses', {
      title,
      slug,
      subtitle: src.subtitle ?? '',
      description: src.description ?? '',
      learning_objectives: src.learning_objectives ?? JSON.stringify([]),
      category: cat ?? null,
      instructor: instructorId,
      status: 'Draft',
      visibility: 'Public',
      difficulty: src.difficulty ?? 'Beginner',
      language: src.language ?? 'English',
      is_free: src.is_free ?? true,
      price: src.price ?? 0,
      currency: src.currency ?? 'USD',
      trailer_video_url: src.trailer_video_url ?? null,
      has_certificate: src.has_certificate ?? false,
      self_paced: true,
      passing_score: 70,
      default_completion_threshold: 90,
      default_video_player_theme: 'light',
    }),
  )) as UnknownRecord;

  const newId = String(newCourse.id);
  const modules = (src.modules as UnknownRecord[] | undefined) ?? [];
  for (const m of [...modules].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))) {
    const mod = await directus.request(
      ci('modules', {
        title: m.title,
        description: m.description ?? null,
        sort_order: m.sort_order ?? 0,
        course: newId,
      }),
    );
    const modId = String((mod as UnknownRecord).id);
    const lessons = (m.lessons as UnknownRecord[] | undefined) ?? [];
    for (const l of [...lessons].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))) {
      const payload: UnknownRecord = {
        title: l.title,
        lesson_type: l.lesson_type,
        sort_order: l.sort_order ?? 0,
        module: modId,
        duration_minutes: l.duration_minutes ?? 0,
        is_preview: l.is_preview ?? false,
        required: l.required ?? true,
        completion_criteria: l.completion_criteria ?? 'view',
      };
      if (l.lesson_type === 'video') {
        payload.video_source = l.video_source ?? null;
        payload.video_youtube_id = l.video_youtube_id ?? null;
        payload.video_vimeo_id = l.video_vimeo_id ?? null;
        payload.video_file = typeof l.video_file === 'object' && l.video_file && 'id' in l.video_file ? (l.video_file as { id: string }).id : l.video_file ?? null;
        payload.video_url = l.video_url ?? null;
        payload.video_duration_seconds = l.video_duration_seconds ?? null;
        payload.video_chapters = l.video_chapters ?? null;
        payload.video_transcript = l.video_transcript ?? null;
      } else if (l.lesson_type === 'text') payload.text_body = l.text_body ?? '';
      else if (l.lesson_type === 'pdf') payload.pdf_file = typeof l.pdf_file === 'object' && l.pdf_file && 'id' in l.pdf_file ? (l.pdf_file as { id: string }).id : l.pdf_file ?? null;
      else if (l.lesson_type === 'external_link') payload.external_url = l.external_url ?? '';
      else if (l.lesson_type === 'quiz' && l.quiz) {
        payload.quiz = typeof l.quiz === 'object' && l.quiz && 'id' in l.quiz ? (l.quiz as { id: string }).id : l.quiz;
      } else if (l.lesson_type === 'assignment' && l.assignment) {
        payload.assignment =
          typeof l.assignment === 'object' && l.assignment && 'id' in l.assignment
            ? (l.assignment as { id: string }).id
            : l.assignment;
      }
      await directus.request(ci('lessons', payload));
    }
  }
  return newCourse;
}

export const instructorCourseEditorFields = [
  'id',
  'title',
  'slug',
  'subtitle',
  'description',
  'status',
  'visibility',
  'published_at',
  'duration_minutes',
  'difficulty',
  'language',
  'price',
  'currency',
  'is_free',
  'average_rating',
  'rating_count',
  'cover_image',
  'learning_objectives',
  'trailer_video_url',
  'enrollment_count',
  'completion_count',
  'enrollment_limit',
  'enrollment_deadline',
  'self_paced',
  'passing_score',
  'has_certificate',
  'default_completion_threshold',
  'default_video_player_theme',
  'instructor.id',
  'category.id',
  'category.name',
  'category.slug',
  'tags.id',
  'tags.course_tags_id.id',
  'tags.course_tags_id.name',
  'tags.course_tags_id.slug',
  'co_instructors.id',
  'co_instructors.directus_users_id.id',
  'co_instructors.directus_users_id.first_name',
  'co_instructors.directus_users_id.last_name',
  'prerequisites.id',
  'prerequisites.courses_id.id',
  'prerequisites.courses_id.title',
  'prerequisites.courses_id.slug',
  'modules.id',
  'modules.title',
  'modules.description',
  'modules.sort_order',
  'modules.lessons.id',
  'modules.lessons.title',
  'modules.lessons.lesson_type',
  'modules.lessons.duration_minutes',
  'modules.lessons.is_preview',
  'modules.lessons.sort_order',
  'modules.lessons.required',
  'modules.lessons.completion_criteria',
  'modules.lessons.video_source',
  'modules.lessons.video_youtube_id',
  'modules.lessons.video_vimeo_id',
  'modules.lessons.video_file',
  'modules.lessons.video_url',
  'modules.lessons.video_duration_seconds',
  'modules.lessons.video_thumbnail',
  'modules.lessons.video_captions',
  'modules.lessons.video_chapters',
  'modules.lessons.video_transcript',
  'modules.lessons.resume_from_last_position',
  'modules.lessons.completion_threshold',
  'modules.lessons.allow_download',
  'modules.lessons.text_body',
  'modules.lessons.pdf_file',
  'modules.lessons.external_url',
  'modules.lessons.allow_embed',
  'modules.lessons.quiz.id',
  'modules.lessons.quiz.title',
  'modules.lessons.assignment.id',
  'modules.lessons.assignment.title',
] as const;

export async function fetchCourseForEditor(courseId: string) {
  assertUrl();
  return directus.request(
    rone('courses', courseId, {
      fields: [...instructorCourseEditorFields],
    }),
  ) as Promise<UnknownRecord>;
}

export async function updateCourse(courseId: string, patch: UnknownRecord) {
  assertUrl();
  return directus.request(ui('courses', courseId, patch)) as Promise<UnknownRecord>;
}

export async function createModule(courseId: string, title: string, sortOrder: number) {
  assertUrl();
  return directus.request(ci('modules', { course: courseId, title, sort_order: sortOrder })) as Promise<UnknownRecord>;
}

export async function updateModule(moduleId: string, patch: UnknownRecord) {
  assertUrl();
  return directus.request(ui('modules', moduleId, patch)) as Promise<UnknownRecord>;
}

export async function deleteModule(moduleId: string) {
  assertUrl();
  return directus.request(di('modules', moduleId));
}

export async function createLesson(payload: UnknownRecord) {
  assertUrl();
  return directus.request(ci('lessons', payload)) as Promise<UnknownRecord>;
}

export async function updateLesson(lessonId: string, patch: UnknownRecord) {
  assertUrl();
  return directus.request(ui('lessons', lessonId, patch)) as Promise<UnknownRecord>;
}

export async function deleteLesson(lessonId: string) {
  assertUrl();
  return directus.request(di('lessons', lessonId));
}

export async function fetchCourseTags() {
  assertUrl();
  return directus.request(
    ri('course_tags', { sort: ['name'], limit: -1, fields: ['id', 'name', 'slug'] }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchCoursesForPrerequisitePicker(excludeId: string) {
  assertUrl();
  return directus.request(
    ri('courses', {
      filter: { id: { _neq: excludeId } },
      sort: ['title'],
      limit: 200,
      fields: ['id', 'title', 'slug', 'status'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchInstructorsForCoPicker(excludeId: string) {
  assertUrl();
  return directus.request(
    ri('directus_users', {
      filter: { id: { _neq: excludeId } },
      sort: ['first_name', 'last_name'],
      limit: 200,
      fields: ['id', 'first_name', 'last_name', 'email', 'avatar'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchAnnouncementsForCourse(courseId: string) {
  assertUrl();
  return directus.request(
    ri('announcements', {
      filter: { course: { _eq: courseId } },
      sort: ['-published_at'],
      limit: 50,
      fields: ['id', 'title', 'body', 'published_at', 'is_pinned', 'author.id', 'author.first_name', 'author.last_name'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function createAnnouncement(courseId: string, authorId: string, body: UnknownRecord) {
  assertUrl();
  return directus.request(
    ci('announcements', {
      course: courseId,
      author: authorId,
      title: String(body.title ?? ''),
      body: String(body.body ?? ''),
      is_pinned: Boolean(body.is_pinned),
      published_at: String(body.published_at ?? new Date().toISOString()),
    }),
  ) as Promise<UnknownRecord>;
}

export async function uploadLessonFile(file: File) {
  assertUrl();
  const fd = new FormData();
  fd.append('file', file);
  const created = await directus.request(uf(fd));
  const rows = Array.isArray(created) ? created : [created];
  return (rows as UnknownRecord[])[0] as UnknownRecord;
}

export async function fetchQuizForEditor(quizId: string) {
  assertUrl();
  return directus.request(
    rone('quizzes', quizId, {
      fields: [
        'id',
        'title',
        'description',
        'course',
        'time_limit_minutes',
        'max_attempts',
        'passing_score',
        'shuffle_questions',
        'shuffle_options',
        'show_correct_answers',
        'show_results_immediately',
        'questions.id',
        'questions.question_type',
        'questions.prompt',
        'questions.points',
        'questions.sort_order',
        'questions.options.id',
        'questions.options.label',
        'questions.options.is_correct',
        'questions.options.sort_order',
      ],
    }),
  ) as Promise<UnknownRecord>;
}

export async function updateQuiz(quizId: string, patch: UnknownRecord) {
  assertUrl();
  return directus.request(ui('quizzes', quizId, patch)) as Promise<UnknownRecord>;
}

export async function createQuestion(quizId: string, payload: UnknownRecord) {
  assertUrl();
  return directus.request(ci('questions', { ...payload, quiz: quizId })) as Promise<UnknownRecord>;
}

export async function updateQuestion(questionId: string, patch: UnknownRecord) {
  assertUrl();
  return directus.request(ui('questions', questionId, patch)) as Promise<UnknownRecord>;
}

export async function deleteQuestion(questionId: string) {
  assertUrl();
  return directus.request(di('questions', questionId));
}

export async function createQuestionOption(questionId: string, label: string, isCorrect: boolean, sortOrder: number) {
  assertUrl();
  return directus.request(
    ci('question_options', { question: questionId, label, is_correct: isCorrect, sort_order: sortOrder }),
  ) as Promise<UnknownRecord>;
}

export async function updateQuestionOption(optionId: string, patch: UnknownRecord) {
  assertUrl();
  return directus.request(ui('question_options', optionId, patch)) as Promise<UnknownRecord>;
}

export async function deleteQuestionOption(optionId: string) {
  assertUrl();
  return directus.request(di('question_options', optionId));
}

export async function fetchAssignmentForEditor(assignmentId: string) {
  assertUrl();
  return directus.request(
    rone('assignments', assignmentId, {
      fields: [
        'id',
        'title',
        'description',
        'instructions',
        'due_date',
        'max_points',
        'passing_score',
        'allow_late_submissions',
        'late_penalty_pct',
        'submission_types',
        'rubric',
        'course',
      ],
    }),
  ) as Promise<UnknownRecord>;
}

export async function updateAssignment(assignmentId: string, patch: UnknownRecord) {
  assertUrl();
  return directus.request(ui('assignments', assignmentId, patch)) as Promise<UnknownRecord>;
}

export async function createQuizShell(courseId: string, title: string) {
  assertUrl();
  return directus.request(
    ci('quizzes', {
      course: courseId,
      title,
      description: '',
      time_limit_minutes: 30,
      max_attempts: 3,
      passing_score: 70,
      shuffle_questions: false,
      shuffle_options: true,
      show_correct_answers: 'after_pass',
      show_results_immediately: true,
    }),
  ) as Promise<UnknownRecord>;
}

export async function createAssignmentShell(courseId: string, title: string) {
  assertUrl();
  return directus.request(
    ci('assignments', {
      course: courseId,
      title,
      description: '',
      instructions: '',
      max_points: 100,
      passing_score: 70,
      allow_late_submissions: true,
      late_penalty_pct: 10,
      submission_types: ['file', 'text'],
    }),
  ) as Promise<UnknownRecord>;
}

export async function fetchEnrollmentsForCourse(courseId: string, filters?: { status?: string; progress?: string }) {
  assertUrl();
  const parts: UnknownRecord[] = [{ course: { _eq: courseId } }];
  if (filters?.status) parts.push({ status: { _eq: filters.status } });
  if (filters?.progress === '0') parts.push({ progress_pct: { _eq: 0 } });
  if (filters?.progress === '1-50') {
    parts.push({ _and: [{ progress_pct: { _gt: 0 } }, { progress_pct: { _lte: 50 } }] });
  }
  if (filters?.progress === '51-99') {
    parts.push({ _and: [{ progress_pct: { _gt: 50 } }, { progress_pct: { _lt: 100 } }] });
  }
  if (filters?.progress === '100') parts.push({ progress_pct: { _eq: 100 } });
  const filter = parts.length > 1 ? { _and: parts } : parts[0];
  return directus.request(
    ri('enrollments', {
      filter,
      sort: ['-date_updated'],
      limit: -1,
      fields: [
        'id',
        'status',
        'progress_pct',
        'enrolled_at',
        'final_grade',
        'certificate_issued',
        'user.id',
        'user.first_name',
        'user.last_name',
        'user.email',
        'user.avatar',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchLessonProgressForEnrollment(enrollmentId: string) {
  assertUrl();
  return directus.request(
    ri('lesson_progress', {
      filter: { enrollment: { _eq: enrollmentId } },
      limit: -1,
      fields: [
        'id',
        'status',
        'completed_at',
        'time_spent_seconds',
        'lesson.id',
        'lesson.title',
        'lesson.lesson_type',
        'lesson.sort_order',
        'lesson.module.sort_order',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchSubmissionsForGrading(courseId: string, status: 'submitted' | 'graded') {
  assertUrl();
  return directus.request(
    ri('submissions', {
      filter: {
        _and: [{ status: { _eq: status } }, { assignment: { course: { _eq: courseId } } }],
      },
      sort: ['-submitted_at'],
      limit: -1,
      fields: [
        'id',
        'status',
        'submitted_at',
        'graded_at',
        'grade',
        'grader_feedback',
        'text_response',
        'url_response',
        'is_late',
        'user.id',
        'user.first_name',
        'user.last_name',
        'user.email',
        'assignment.id',
        'assignment.title',
        'files.id',
        'files.directus_files_id.id',
        'files.directus_files_id.filename_download',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function saveSubmissionGrade(
  submissionId: string,
  patch: { grade?: number | null; grader_feedback?: string; status: string; graded_by?: string },
) {
  assertUrl();
  return directus.request(
    ui('submissions', submissionId, {
      ...patch,
      graded_at: patch.status === 'graded' ? new Date().toISOString() : null,
    }),
  ) as Promise<UnknownRecord>;
}

export async function fetchEssayQuizResponsesForGrading(courseId: string) {
  assertUrl();
  return directus.request(
    ri('quiz_responses', {
      filter: {
        _and: [
          { question: { question_type: { _in: ['essay', 'short_answer'] } } },
          {
            _or: [{ graded_by: { _null: true } }, { is_correct: { _null: true } }],
          },
          { attempt: { quiz: { course: { _eq: courseId } } } },
        ],
      },
      sort: ['-date_updated'],
      limit: -1,
      fields: [
        'id',
        'text_answer',
        'is_correct',
        'points_earned',
        'grader_feedback',
        'question.id',
        'question.prompt',
        'question.points',
        'question.question_type',
        'attempt.id',
        'attempt.user.id',
        'attempt.user.first_name',
        'attempt.user.last_name',
        'attempt.user.email',
        'attempt.quiz.title',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function saveQuizResponseGrade(
  responseId: string,
  patch: { is_correct?: boolean | null; points_earned?: number | null; grader_feedback?: string; graded_by?: string },
) {
  assertUrl();
  return directus.request(ui('quiz_responses', responseId, patch)) as Promise<UnknownRecord>;
}

export async function fetchCourseAnalytics(courseId: string) {
  assertUrl();
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceIso = since.toISOString();

  const [enrollments, enrollments90, lessonProgress, reviews, courseRow] = await Promise.all([
    directus.request(
      ri('enrollments', {
        filter: { course: { _eq: courseId } },
        limit: -1,
        fields: ['id', 'status', 'progress_pct', 'date_created', 'completed_at'],
      }),
    ) as Promise<UnknownRecord[]>,
    directus.request(
      ri('enrollments', {
        filter: { _and: [{ course: { _eq: courseId } }, { date_created: { _gte: sinceIso } }] },
        limit: -1,
        fields: ['id', 'date_created'],
      }),
    ) as Promise<UnknownRecord[]>,
    directus.request(
      ri('lesson_progress', {
        filter: { enrollment: { course: { _eq: courseId } } },
        limit: 2000,
        fields: ['id', 'status', 'lesson', 'lesson.id', 'lesson.title'],
      }),
    ) as Promise<UnknownRecord[]>,
    directus.request(
      ri('reviews', {
        filter: { course: { _eq: courseId }, is_approved: { _eq: true } },
        limit: -1,
        fields: ['rating'],
      }),
    ) as Promise<UnknownRecord[]>,
    directus.request(
      rone('courses', courseId, {
        fields: ['enrollment_count', 'completion_count', 'average_rating', 'rating_count'],
      }),
    ) as Promise<UnknownRecord>,
  ]);

  const quizzes = (await directus.request(
    ri('quizzes', {
      filter: { course: { _eq: courseId } },
      fields: ['id', 'title'],
      limit: -1,
    }),
  )) as UnknownRecord[];

  const quizScores: { quizId: string; title: string; avg: number; n: number }[] = [];
  for (const q of quizzes) {
    const attempts = (await directus.request(
      ri('quiz_attempts', {
        filter: { quiz: { _eq: String(q.id) }, status: { _eq: 'graded' } },
        limit: 500,
        fields: ['score'],
      }),
    )) as UnknownRecord[];
    let sum = 0;
    let n = 0;
    for (const a of attempts) {
      const s = Number(a.score ?? 0);
      if (Number.isFinite(s)) {
        sum += s;
        n += 1;
      }
    }
    quizScores.push({ quizId: String(q.id), title: String(q.title ?? 'Quiz'), avg: n ? sum / n : 0, n });
  }

  return {
    enrollments,
    enrollments90,
    lessonProgress,
    reviews,
    courseRow,
    quizScores,
  };
}
