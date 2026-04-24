import { createItem, deleteItem, readItem, readItems, updateItem, uploadFiles } from '@directus/sdk';
import { directus, hasDirectusEnv } from '@/lib/directus';
import type { UnknownRecord } from '@/api/public';
import { fetchCourseBySlug } from '@/api/public';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ri = readItems as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ci = createItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rone = readItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ui = updateItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const di = deleteItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const uf = uploadFiles as any;
function assertUrl() {
  if (!hasDirectusEnv()) throw new Error('VITE_DIRECTUS_URL is not set');
}

export type EnrollmentTab = 'all' | 'in_progress' | 'completed' | 'dropped';

function enrollmentFilterForTab(tab: EnrollmentTab): UnknownRecord | undefined {
  switch (tab) {
    case 'in_progress':
      return { _and: [{ status: { _eq: 'active' } }, { progress_pct: { _lt: 100 } }] };
    case 'completed':
      return { status: { _eq: 'completed' } };
    case 'dropped':
      return { status: { _eq: 'dropped' } };
    default:
      return undefined;
  }
}

const enrollmentCourseFields = [
  'id',
  'status',
  'progress_pct',
  'date_updated',
  'enrolled_at',
  'started_at',
  'completed_at',
  'final_grade',
  'certificate_issued',
  'course.id',
  'course.title',
  'course.slug',
  'course.subtitle',
  'course.description',
  'course.duration_minutes',
  'course.difficulty',
  'course.price',
  'course.currency',
  'course.is_free',
  'course.average_rating',
  'course.rating_count',
  'course.cover_image',
  'course.instructor.id',
  'course.instructor.first_name',
  'course.instructor.last_name',
  'course.instructor.avatar',
  'course.category.id',
  'course.category.name',
  'course.category.slug',
] as const;

export async function fetchMyEnrollments(userId: string, tab: EnrollmentTab) {
  assertUrl();
  const tabFilter = enrollmentFilterForTab(tab);
  const filter: UnknownRecord = {
    _and: [{ user: { _eq: userId } }, ...(tabFilter ? [tabFilter] : [])],
  };
  return directus.request(
    ri('enrollments', {
      filter,
      sort: ['-date_updated'],
      limit: -1,
      fields: [...enrollmentCourseFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchContinueEnrollments(userId: string, limit = 3) {
  assertUrl();
  return directus.request(
    ri('enrollments', {
      filter: {
        _and: [
          { user: { _eq: userId } },
          { status: { _eq: 'active' } },
          { progress_pct: { _lt: 100 } },
        ],
      },
      sort: ['-date_updated'],
      limit,
      fields: [...enrollmentCourseFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchEnrollmentByCourseSlug(courseSlug: string, userId: string) {
  assertUrl();
  const rows = await directus.request(
    ri('enrollments', {
      filter: {
        _and: [{ user: { _eq: userId } }, { course: { slug: { _eq: courseSlug } } }],
      },
      limit: 1,
      fields: [
        'id',
        'status',
        'progress_pct',
        'course.id',
        'course.slug',
        'course.title',
        'course.default_completion_threshold',
        'course.default_video_player_theme',
      ],
    }),
  );
  return (rows as UnknownRecord[])[0] ?? null;
}

export async function fetchLessonProgressForEnrollment(enrollmentId: string, userId: string) {
  assertUrl();
  return directus.request(
    ri('lesson_progress', {
      filter: { _and: [{ enrollment: { _eq: enrollmentId } }, { user: { _eq: userId } }] },
      limit: -1,
      fields: [
        'id',
        'lesson',
        'status',
        'last_position_seconds',
        'watched_seconds',
        'last_watched_at',
        'time_spent_seconds',
        'completed_at',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchCourseForPlayer(slug: string) {
  assertUrl();
  return fetchCourseBySlug(slug, { authenticated: true });
}

export async function fetchLessonResources(lessonId: string) {
  assertUrl();
  try {
    return await directus.request(
      ri('lessons_resources', {
        filter: { lesson: { _eq: lessonId } },
        sort: ['id'],
        limit: -1,
        fields: ['id', 'title', 'description', 'file', 'external_url'],
      }),
    );
  } catch {
    return await directus.request(
      ri('lessons_resources', {
        filter: { lesson: { _eq: lessonId } },
        limit: -1,
        fields: ['id', 'title', 'description', 'file'],
      }),
    );
  }
}

export async function fetchMyCertificates(userId: string) {
  assertUrl();
  return directus.request(
    ri('certificates', {
      filter: { user: { _eq: userId } },
      sort: ['-issued_at'],
      limit: -1,
      fields: [
        'id',
        'certificate_number',
        'verification_code',
        'issued_at',
        'final_grade',
        'course.title',
        'course.slug',
        'template.id',
        'template.name',
        'template.html_template',
        'template.accent_color',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchMyBadges(userId: string) {
  assertUrl();
  return directus.request(
    ri('user_badges', {
      filter: { user: { _eq: userId } },
      sort: ['-awarded_at'],
      limit: -1,
      fields: ['id', 'awarded_at', 'awarded_context', 'badge.id', 'badge.name', 'badge.icon', 'badge.color', 'badge.description'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function createQuizAttemptForUser(params: {
  userId: string;
  quizId: string;
  enrollmentId: string;
}) {
  assertUrl();
  const { userId, quizId, enrollmentId } = params;
  const prev = await directus.request(
    ri('quiz_attempts', {
      filter: { _and: [{ user: { _eq: userId } }, { quiz: { _eq: quizId } }] },
      sort: ['-attempt_number'],
      limit: 1,
      fields: ['attempt_number'],
    }),
  );
  const lastNum = Number((Array.isArray(prev) ? prev[0] : null)?.attempt_number ?? 0);
  const attempt_number = (Number.isFinite(lastNum) ? lastNum : 0) + 1;
  const row = await directus.request(
    ci('quiz_attempts', {
      user: userId,
      quiz: quizId,
      enrollment: enrollmentId,
      status: 'in_progress',
      attempt_number,
    }),
  );
  return row as UnknownRecord;
}

export async function fetchQuizAttemptsForUser(userId: string, quizId: string) {
  assertUrl();
  return directus.request(
    ri('quiz_attempts', {
      filter: { _and: [{ user: { _eq: userId } }, { quiz: { _eq: quizId } }] },
      sort: ['-attempt_number'],
      limit: -1,
      fields: ['id', 'attempt_number', 'status', 'score', 'passed', 'submitted_at'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchQuizAttemptDetail(attemptId: string) {
  assertUrl();
  return directus.request(
    rone('quiz_attempts', attemptId, {
      fields: [
        'id',
        'attempt_number',
        'started_at',
        'submitted_at',
        'score',
        'points_earned',
        'points_possible',
        'passed',
        'time_spent_seconds',
        'status',
        'enrollment.id',
        'enrollment.course.slug',
        'enrollment.course.title',
        'quiz.id',
        'quiz.title',
        'quiz.description',
        'quiz.time_limit_minutes',
        'quiz.max_attempts',
        'quiz.passing_score',
        'quiz.shuffle_questions',
        'quiz.shuffle_options',
        'quiz.show_correct_answers',
        'quiz.show_results_immediately',
        'quiz.questions.id',
        'quiz.questions.question_type',
        'quiz.questions.prompt',
        'quiz.questions.points',
        'quiz.questions.sort_order',
        'quiz.questions.explanation',
        'quiz.questions.required',
        'quiz.questions.options.id',
        'quiz.questions.options.label',
        'quiz.questions.options.is_correct',
        'quiz.questions.options.sort_order',
        'quiz.questions.options.feedback',
        'responses.id',
        'responses.question',
        'responses.question.id',
        'responses.selected_options.id',
        'responses.selected_options.label',
        'responses.text_answer',
        'responses.is_correct',
        'responses.points_earned',
        'responses.grader_feedback',
      ],
    }),
  ) as Promise<UnknownRecord>;
}

export async function upsertQuizResponse(params: {
  attemptId: string;
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
}) {
  assertUrl();
  const existing = await directus.request(
    ri('quiz_responses', {
      filter: { _and: [{ attempt: { _eq: params.attemptId } }, { question: { _eq: params.questionId } }] },
      limit: 1,
      fields: ['id'],
    }),
  );
  const row = (Array.isArray(existing) ? existing[0] : null) as { id?: string } | null;
  const payload: UnknownRecord = {
    attempt: params.attemptId,
    question: params.questionId,
    text_answer: params.textAnswer ?? null,
    selected_options: params.selectedOptionIds ?? [],
  };
  if (row?.id) {
    return directus.request(ui('quiz_responses', row.id, payload)) as Promise<UnknownRecord>;
  }
  return directus.request(ci('quiz_responses', payload)) as Promise<UnknownRecord>;
}

export async function submitQuizAttempt(attemptId: string, timeSpentSeconds: number) {
  assertUrl();
  return directus.request(
    ui('quiz_attempts', attemptId, {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      time_spent_seconds: Math.max(0, Math.floor(timeSpentSeconds)),
    }),
  ) as Promise<UnknownRecord>;
}

export async function saveQuizAttemptProgress(attemptId: string, timeSpentSeconds: number) {
  assertUrl();
  return directus.request(
    ui('quiz_attempts', attemptId, {
      status: 'in_progress',
      time_spent_seconds: Math.max(0, Math.floor(timeSpentSeconds)),
    }),
  ) as Promise<UnknownRecord>;
}

export async function fetchAssignmentDetail(assignmentId: string, userId: string) {
  assertUrl();
  const assignment = await directus.request(
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
        'course.id',
        'course.slug',
        'course.title',
      ],
    }),
  );
  const submissions = await directus.request(
    ri('submissions', {
      filter: { _and: [{ assignment: { _eq: assignmentId } }, { user: { _eq: userId } }] },
      sort: ['-attempt_number', '-date_updated'],
      limit: 1,
      fields: [
        'id',
        'status',
        'submitted_at',
        'text_response',
        'url_response',
        'grade',
        'grader_feedback',
        'graded_at',
        'is_late',
        'attempt_number',
        'enrollment',
        'files.id',
        'files.directus_files_id.id',
        'files.directus_files_id.filename_download',
        'files.directus_files_id.title',
      ],
    }),
  );
  return {
    assignment: assignment as UnknownRecord,
    submission: ((submissions as UnknownRecord[])[0] ?? null) as UnknownRecord | null,
  };
}

export async function fetchEnrollmentByCourseId(courseId: string, userId: string) {
  assertUrl();
  const rows = await directus.request(
    ri('enrollments', {
      filter: { _and: [{ user: { _eq: userId } }, { course: { _eq: courseId } }] },
      limit: 1,
      fields: ['id', 'status', 'course.slug', 'course.title'],
    }),
  );
  return (rows as UnknownRecord[])[0] ?? null;
}

export async function uploadSubmissionFiles(files: File[]) {
  assertUrl();
  const out: UnknownRecord[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    const created = await directus.request(uf(fd));
    const rows = Array.isArray(created) ? created : [created];
    out.push(...(rows as UnknownRecord[]));
  }
  return out;
}

export async function saveAssignmentSubmission(params: {
  submissionId?: string | null;
  assignmentId: string;
  userId: string;
  enrollmentId?: string | null;
  status: 'draft' | 'submitted';
  textResponse?: string | null;
  urlResponse?: string | null;
  fileIds?: string[];
  isLate?: boolean;
}) {
  assertUrl();
  const payload: UnknownRecord = {
    assignment: params.assignmentId,
    user: params.userId,
    enrollment: params.enrollmentId ?? null,
    status: params.status,
    text_response: params.textResponse ?? null,
    url_response: params.urlResponse ?? null,
    files: params.fileIds ?? [],
    is_late: params.isLate ?? false,
    ...(params.status === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
  };
  if (params.submissionId) {
    return directus.request(ui('submissions', params.submissionId, payload)) as Promise<UnknownRecord>;
  }
  return directus.request(ci('submissions', payload)) as Promise<UnknownRecord>;
}

export async function removeSubmissionFileJunction(junctionId: string) {
  assertUrl();
  return directus.request(di('submissions_files', junctionId));
}

export async function fetchAssignmentsForLearner(userId: string) {
  assertUrl();
  return directus.request(
    ri('assignments', {
      filter: { course: { enrollments: { user: { _eq: userId } } } },
      sort: ['due_date'],
      limit: -1,
      fields: [
        'id',
        'title',
        'due_date',
        'max_points',
        'passing_score',
        'course.id',
        'course.slug',
        'course.title',
        'submissions.id',
        'submissions.status',
        'submissions.grade',
        'submissions.submitted_at',
        'submissions.user',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchMeProfileByReadItems(userId: string) {
  assertUrl();
  const rows = await directus.request(
    ri('directus_users', {
      filter: { id: { _eq: userId } },
      limit: 1,
      fields: [
        'id',
        'first_name',
        'last_name',
        'email',
        'avatar',
        'bio',
        'headline',
        'social_twitter',
        'social_linkedin',
        'social_youtube',
        'social_website',
      ],
    }),
  );
  return (rows as UnknownRecord[])[0] ?? null;
}
