import { aggregate, createItem, readItem, readItems, readMe } from '@directus/sdk';
import { directus, hasDirectusEnv } from '@/lib/directus';

export type UnknownRecord = Record<string, unknown>;

/** No generated Directus schema in this repo — relax collection typing for `readItems` / `aggregate` / etc. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ri = readItems as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rone = readItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const aggQuery = aggregate as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ci = createItem as any;

function assertUrl() {
  if (!hasDirectusEnv()) throw new Error('VITE_DIRECTUS_URL is not set');
}

/** Explicit fields only (avoid `*`) so Public field rules stay predictable. */
const courseCardFields = [
  'id',
  'title',
  'slug',
  'subtitle',
  'description',
  'duration_minutes',
  'difficulty',
  'language',
  'price',
  'currency',
  'is_free',
  'average_rating',
  'rating_count',
  'cover_image',
  'instructor.id',
  'instructor.first_name',
  'instructor.last_name',
  'instructor.avatar',
  'category.id',
  'category.name',
  'category.slug',
] as const;

/**
 * Explicit course columns only (no `*`). Public roles often cannot read internal fields like
 * `status` / `visibility`; requesting `*` makes the entire `readItems` fail with 403.
 */
export const courseDetailFields = [
  'id',
  'title',
  'slug',
  'subtitle',
  'description',
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
  'date_updated',
  'enrollment_count',
  'default_completion_threshold',
  'default_video_player_theme',
  'instructor.id',
  'instructor.first_name',
  'instructor.last_name',
  'instructor.avatar',
  'instructor.bio',
  'instructor.headline',
  'instructor.total_students',
  'instructor.total_courses',
  'instructor.average_rating',
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
  'co_instructors.directus_users_id.avatar',
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
  'modules.lessons.video_source',
  'modules.lessons.video_youtube_id',
  'modules.lessons.video_vimeo_id',
  'modules.lessons.video_file',
  'modules.lessons.video_url',
  'modules.lessons.video_duration_seconds',
  'modules.lessons.video_captions',
  'modules.lessons.video_chapters',
  'modules.lessons.video_transcript',
  'modules.lessons.resume_from_last_position',
  'modules.lessons.completion_threshold',
  'modules.lessons.text_body',
  'modules.lessons.pdf_file',
  'modules.lessons.external_url',
  'modules.lessons.allow_embed',
  'modules.lessons.quiz.id',
  'modules.lessons.quiz.title',
  'modules.lessons.quiz.description',
  'modules.lessons.quiz.time_limit_minutes',
  'modules.lessons.quiz.max_attempts',
  'modules.lessons.quiz.passing_score',
  'modules.lessons.assignment.id',
  'modules.lessons.assignment.title',
  'modules.lessons.assignment.description',
  'modules.lessons.assignment.instructions',
  'modules.lessons.assignment.due_date',
  'modules.lessons.assignment.max_points',
] as const;

export async function fetchFeaturedCourses() {
  assertUrl();
  return directus.request(
    ri('courses', {
      sort: ['-average_rating'],
      limit: 12,
      fields: [...courseCardFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchNewCourses() {
  assertUrl();
  return directus.request(
    ri('courses', {
      sort: ['-published_at'],
      limit: 12,
      fields: [...courseCardFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchCoursesByCategoryId(categoryId: string, limit = 12) {
  assertUrl();
  return directus.request(
    ri('courses', {
      filter: { category: { _eq: categoryId } },
      sort: ['-average_rating'],
      limit,
      fields: [...courseCardFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchCoursesByCategoryIds(categoryIds: string[], limit = -1) {
  assertUrl();
  if (!categoryIds.length) return [] as UnknownRecord[];
  return directus.request(
    ri('courses', {
      filter: { category: { _in: categoryIds } },
      sort: ['-average_rating'],
      limit,
      fields: [...courseCardFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchRootCategories() {
  assertUrl();
  return directus.request(
    ri('categories', {
      filter: { parent: { _null: true } },
      sort: ['sort_order', 'name'],
      limit: -1,
      fields: ['id', 'name', 'slug', 'description', 'icon', 'course_count', 'sort_order'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchAllCategories() {
  assertUrl();
  return directus.request(
    ri('categories', {
      sort: ['sort_order', 'name'],
      limit: -1,
      fields: ['id', 'name', 'slug', 'parent', 'description', 'icon', 'course_count', 'sort_order'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchCategoryBySlug(slug: string) {
  assertUrl();
  const rows = await directus.request(
    ri('categories', {
      filter: { slug: { _eq: slug } },
      limit: 1,
      fields: ['id', 'name', 'slug', 'description', 'icon', 'course_count', 'parent', 'sort_order'],
    }),
  );
  return (rows as UnknownRecord[])[0] ?? null;
}

export async function fetchFeaturedInstructors(limit = 6) {
  assertUrl();
  return directus.request(
    ri('directus_users', {
      filter: { is_instructor: { _eq: true } },
      sort: ['-total_students'],
      limit,
      fields: [
        'id',
        'first_name',
        'last_name',
        'avatar',
        'headline',
        'bio',
        'total_students',
        'total_courses',
        'average_rating',
        'social_twitter',
        'social_linkedin',
        'social_youtube',
        'social_website',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchInstructorsPage(limit = 48) {
  assertUrl();
  return directus.request(
    ri('directus_users', {
      filter: { is_instructor: { _eq: true } },
      sort: ['-total_students'],
      limit,
      fields: [
        'id',
        'first_name',
        'last_name',
        'avatar',
        'headline',
        'total_students',
        'total_courses',
        'average_rating',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchInstructorById(id: string) {
  assertUrl();
  return directus.request(
    rone('directus_users', id, {
      fields: [
        'id',
        'first_name',
        'last_name',
        'avatar',
        'headline',
        'bio',
        'total_students',
        'total_courses',
        'average_rating',
        'social_twitter',
        'social_linkedin',
        'social_youtube',
        'social_website',
      ],
    }),
  ) as Promise<UnknownRecord>;
}

export async function fetchCoursesByInstructor(instructorId: string) {
  assertUrl();
  return directus.request(
    ri('courses', {
      filter: { instructor: { _eq: instructorId } },
      sort: ['-published_at'],
      limit: -1,
      fields: [...courseCardFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchTestimonialReviews() {
  assertUrl();
  return directus.request(
    ri('reviews', {
      filter: { _and: [{ rating: { _eq: 5 } }, { is_approved: { _eq: true } }] },
      sort: ['-date_created'],
      limit: 12,
      fields: [
        'id',
        'rating',
        'title',
        'body',
        'date_created',
        'user.first_name',
        'user.last_name',
        'course.title',
        'course.slug',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchCourseBySlug(slug: string) {
  assertUrl();
  const rows = await directus.request(
    ri('courses', {
      filter: { slug: { _eq: slug } },
      limit: 1,
      fields: [...courseDetailFields],
    }),
  );
  return (rows as UnknownRecord[])[0] ?? null;
}

export type CatalogSort =
  | 'relevance'
  | 'newest'
  | 'rating'
  | 'popular'
  | 'price_asc'
  | 'price_desc';

export type CatalogFilters = {
  search?: string;
  categorySlugs?: string[];
  difficulties?: string[];
  languages?: string[];
  priceFree?: boolean | null;
  pricePaid?: boolean | null;
  priceMin?: number;
  priceMax?: number;
  duration?: 'short' | 'medium' | 'long' | null;
  minRating?: number | null;
  /** When true, filters `has_certificate` on courses (add field in Directus if missing). */
  hasCertificate?: boolean | null;
  page: number;
  perPage: number;
  sort: CatalogSort;
};

function catalogSortFields(sort: CatalogSort): string[] {
  switch (sort) {
    case 'newest':
      return ['-published_at'];
    case 'rating':
      return ['-average_rating'];
    case 'popular':
      return ['-enrollment_count'];
    case 'price_asc':
      return ['price'];
    case 'price_desc':
      return ['-price'];
    case 'relevance':
    default:
      return ['-average_rating'];
  }
}

export async function fetchCoursesCatalog(filters: CatalogFilters) {
  assertUrl();
  const parts: UnknownRecord[] = [];

  if (filters.categorySlugs?.length) {
    parts.push({ category: { slug: { _in: filters.categorySlugs } } });
  }
  if (filters.difficulties?.length) {
    parts.push({ difficulty: { _in: filters.difficulties } });
  }
  if (filters.languages?.length) {
    parts.push({ language: { _in: filters.languages } });
  }
  if (filters.priceFree && !filters.pricePaid) {
    parts.push({ _or: [{ is_free: { _eq: true } }, { price: { _eq: 0 } }] });
  } else if (filters.pricePaid && !filters.priceFree) {
    parts.push({ _and: [{ is_free: { _neq: true } }, { price: { _gt: 0 } }] });
  }
  if (filters.priceMin != null) {
    parts.push({ price: { _gte: filters.priceMin } });
  }
  if (filters.priceMax != null) {
    parts.push({ price: { _lte: filters.priceMax } });
  }
  if (filters.duration === 'short') {
    parts.push({ duration_minutes: { _lt: 120 } });
  } else if (filters.duration === 'medium') {
    parts.push({ _and: [{ duration_minutes: { _gte: 120 } }, { duration_minutes: { _lte: 600 } }] });
  } else if (filters.duration === 'long') {
    parts.push({ duration_minutes: { _gt: 600 } });
  }
  if (filters.minRating != null) {
    parts.push({ average_rating: { _gte: filters.minRating } });
  }
  if (filters.hasCertificate) {
    parts.push({ has_certificate: { _eq: true } });
  }

  const filter = parts.length ? { _and: parts } : undefined;
  const offset = (filters.page - 1) * filters.perPage;
  const search = filters.search?.trim() || undefined;

  let items: UnknownRecord[];
  let total: number;
  try {
    const pair = await Promise.all([
      directus.request(
        ri('courses', {
          ...(filter ? { filter } : {}),
          sort: catalogSortFields(filters.sort),
          limit: filters.perPage,
          offset,
          ...(search ? { search } : {}),
          fields: [...courseCardFields],
        }),
      ),
      directus.request(
        aggQuery('courses', {
          aggregate: { count: '*' },
          query: { ...(filter ? { filter } : {}), ...(search ? { search } : {}) },
        }),
      ),
    ]);
    items = pair[0] as UnknownRecord[];
    const countVal = (pair[1] as UnknownRecord[] | undefined)?.[0]?.count;
    total =
      typeof countVal === 'string' ? Number.parseInt(countVal, 10) : Number(countVal ?? items.length);
    if (!Number.isFinite(total)) total = items.length;
  } catch {
    const retryParts = parts.filter((p) => !('has_certificate' in (p as object)));
    const retryFilter = retryParts.length ? { _and: retryParts } : undefined;
    const pair = await Promise.all([
      directus.request(
        ri('courses', {
          ...(retryFilter ? { filter: retryFilter } : {}),
          sort: catalogSortFields(filters.sort),
          limit: filters.perPage,
          offset,
          ...(search ? { search } : {}),
          fields: [...courseCardFields],
        }),
      ),
      directus.request(
        aggQuery('courses', {
          aggregate: { count: '*' },
          query: { ...(retryFilter ? { filter: retryFilter } : {}), ...(search ? { search } : {}) },
        }),
      ),
    ]);
    items = pair[0] as UnknownRecord[];
    const countVal = (pair[1] as UnknownRecord[] | undefined)?.[0]?.count;
    total =
      typeof countVal === 'string' ? Number.parseInt(countVal, 10) : Number(countVal ?? items.length);
    if (!Number.isFinite(total)) total = items.length;
  }

  return { courses: items, total };
}

export async function fetchReviewsForCourse(courseId: string, page: number, perPage: number) {
  assertUrl();
  const offset = (page - 1) * perPage;
  const filter = { _and: [{ course: { _eq: courseId } }, { is_approved: { _eq: true } }] };
  const [rows, agg] = await Promise.all([
    directus.request(
      ri('reviews', {
        filter,
        sort: ['-date_created'],
        limit: perPage,
        offset,
        fields: ['id', 'rating', 'title', 'body', 'date_created', 'user.first_name', 'user.last_name'],
      }),
    ),
    directus.request(
      aggQuery('reviews', {
        aggregate: { count: '*' },
        query: { filter },
      }),
    ),
  ]);
  const countVal = (agg as UnknownRecord[] | undefined)?.[0]?.count;
  const total = typeof countVal === 'string' ? Number.parseInt(countVal, 10) : Number(countVal ?? 0);
  return { reviews: rows as UnknownRecord[], total: Number.isFinite(total) ? total : (rows as UnknownRecord[]).length };
}

export async function fetchRatingHistogram(courseId: string) {
  assertUrl();
  try {
    const rows = await directus.request(
      aggQuery('reviews', {
        aggregate: { count: '*' },
        groupBy: ['rating'],
        query: {
          filter: { _and: [{ course: { _eq: courseId } }, { is_approved: { _eq: true } }] },
        },
      }),
    );
    const list = Array.isArray(rows) ? rows : [];
    const map: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of list as UnknownRecord[]) {
      const r = Number(row.rating);
      const c = Number(row.count);
      if (r >= 1 && r <= 5 && Number.isFinite(c)) map[r] = c;
    }
    return map;
  } catch {
    const rows = await directus.request(
      ri('reviews', {
        filter: { _and: [{ course: { _eq: courseId } }, { is_approved: { _eq: true } }] },
        limit: -1,
        fields: ['rating'],
      }),
    );
    const map: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of rows as UnknownRecord[]) {
      const r = Number(row.rating);
      if (r >= 1 && r <= 5) map[r] += 1;
    }
    return map;
  }
}

export async function fetchEnrollment(courseId: string, userId: string) {
  assertUrl();
  const rows = await directus.request(
    ri('enrollments', {
      filter: { _and: [{ course: { _eq: courseId } }, { user: { _eq: userId } }] },
      limit: 1,
      fields: ['id', 'status', 'progress_pct', 'completed_at', 'certificate_issued', 'final_grade', 'date_updated'],
    }),
  );
  return (rows as UnknownRecord[])[0] ?? null;
}

export async function createEnrollmentForCourse(courseId: string) {
  assertUrl();
  return directus.request(
    ci('enrollments', {
      course: courseId,
      status: 'active',
    }),
  ) as Promise<UnknownRecord>;
}

export async function fetchCertificateByCode(code: string) {
  assertUrl();
  const rows = await directus.request(
    ri('certificates', {
      filter: { verification_code: { _eq: code } },
      limit: 1,
      fields: [
        'id',
        'certificate_number',
        'verification_code',
        'issued_at',
        'final_grade',
        'user.first_name',
        'user.last_name',
        'course.title',
        'course.instructor.first_name',
        'course.instructor.last_name',
      ],
    }),
  );
  return (rows as UnknownRecord[])[0] ?? null;
}

export async function globalSearchCourses(q: string) {
  assertUrl();
  return directus.request(
    ri('courses', {
      search: q,
      limit: 3,
      fields: ['id', 'title', 'slug'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function globalSearchCategories(q: string) {
  assertUrl();
  return directus.request(
    ri('categories', {
      search: q,
      limit: 3,
      fields: ['id', 'name', 'slug'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function globalSearchInstructors(q: string) {
  assertUrl();
  return directus.request(
    ri('directus_users', {
      filter: { is_instructor: { _eq: true } },
      search: q,
      limit: 3,
      fields: ['id', 'first_name', 'last_name', 'headline'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function tryReadMe() {
  if (!hasDirectusEnv()) return null;
  try {
    return (await directus.request(readMe({ fields: ['id'] }))) as UnknownRecord;
  } catch {
    return null;
  }
}
