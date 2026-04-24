import { createItem, readItems } from '@directus/sdk';
import { directus, hasDirectusEnv } from '@/lib/directus';
import type { UnknownRecord } from '@/api/public';
import { fetchCourseBySlug } from '@/api/public';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ri = readItems as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ci = createItem as any;
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
  return fetchCourseBySlug(slug);
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
