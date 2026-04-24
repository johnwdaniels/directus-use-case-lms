import { aggregate, createItem, readItem, readItems, readMe } from '@directus/sdk';
import { directus, getDirectusUrl, publicCourseFilter } from '@/lib/directus';

export type UnknownRecord = Record<string, unknown>;

function assertUrl() {
  if (!getDirectusUrl()) throw new Error('VITE_DIRECTUS_URL is not set');
}

const courseCardFields = [
  '*',
  'instructor.id',
  'instructor.first_name',
  'instructor.last_name',
  'instructor.avatar',
  'category.id',
  'category.name',
  'category.slug',
] as const;

export const courseDetailFields = [
  '*',
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
  'modules.lessons.resume_from_last_position',
  'modules.lessons.completion_threshold',
] as const;

export async function fetchFeaturedCourses() {
  assertUrl();
  return directus.request(
    readItems('courses', {
      filter: publicCourseFilter,
      sort: ['-average_rating'],
      limit: 12,
      fields: [...courseCardFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchNewCourses() {
  assertUrl();
  return directus.request(
    readItems('courses', {
      filter: publicCourseFilter,
      sort: ['-published_at'],
      limit: 12,
      fields: [...courseCardFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchCoursesByCategoryId(categoryId: string, limit = 12) {
  assertUrl();
  return directus.request(
    readItems('courses', {
      filter: { _and: [publicCourseFilter, { category: { _eq: categoryId } }] },
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
    readItems('courses', {
      filter: { _and: [publicCourseFilter, { category: { _in: categoryIds } }] },
      sort: ['-average_rating'],
      limit,
      fields: [...courseCardFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchRootCategories() {
  assertUrl();
  return directus.request(
    readItems('categories', {
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
    readItems('categories', {
      sort: ['sort_order', 'name'],
      limit: -1,
      fields: ['id', 'name', 'slug', 'parent', 'description', 'icon', 'course_count', 'sort_order'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchCategoryBySlug(slug: string) {
  assertUrl();
  const rows = await directus.request(
    readItems('categories', {
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
    readItems('directus_users', {
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
    readItems('directus_users', {
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
    readItem('directus_users', id, {
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
    readItems('courses', {
      filter: { _and: [publicCourseFilter, { instructor: { _eq: instructorId } }] },
      sort: ['-published_at'],
      limit: -1,
      fields: [...courseCardFields],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function fetchTestimonialReviews() {
  assertUrl();
  return directus.request(
    readItems('reviews', {
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
    readItems('courses', {
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
  const parts: UnknownRecord[] = [publicCourseFilter];

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

  const filter = { _and: parts };
  const offset = (filters.page - 1) * filters.perPage;
  const search = filters.search?.trim() || undefined;

  let items: UnknownRecord[];
  let total: number;
  try {
    const pair = await Promise.all([
      directus.request(
        readItems('courses', {
          filter,
          sort: catalogSortFields(filters.sort),
          limit: filters.perPage,
          offset,
          search,
          fields: [...courseCardFields],
        }),
      ),
      directus.request(
        aggregate('courses', {
          aggregate: { count: '*' },
          query: { filter, ...(search ? { search } : {}) },
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
    const retryFilter = { _and: retryParts };
    const pair = await Promise.all([
      directus.request(
        readItems('courses', {
          filter: retryFilter,
          sort: catalogSortFields(filters.sort),
          limit: filters.perPage,
          offset,
          search,
          fields: [...courseCardFields],
        }),
      ),
      directus.request(
        aggregate('courses', {
          aggregate: { count: '*' },
          query: { filter: retryFilter, ...(search ? { search } : {}) },
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
      readItems('reviews', {
        filter,
        sort: ['-date_created'],
        limit: perPage,
        offset,
        fields: ['id', 'rating', 'title', 'body', 'date_created', 'user.first_name', 'user.last_name'],
      }),
    ),
    directus.request(
      aggregate('reviews', {
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
      aggregate('reviews', {
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
      readItems('reviews', {
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
    readItems('enrollments', {
      filter: { _and: [{ course: { _eq: courseId } }, { user: { _eq: userId } }] },
      limit: 1,
      fields: ['id', 'status', 'progress_pct'],
    }),
  );
  return (rows as UnknownRecord[])[0] ?? null;
}

export async function createEnrollmentForCourse(courseId: string) {
  assertUrl();
  return directus.request(
    createItem('enrollments', {
      course: courseId,
      status: 'active',
    }),
  ) as Promise<UnknownRecord>;
}

export async function fetchCertificateByCode(code: string) {
  assertUrl();
  const rows = await directus.request(
    readItems('certificates', {
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
    readItems('courses', {
      filter: publicCourseFilter,
      search: q,
      limit: 3,
      fields: ['id', 'title', 'slug'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function globalSearchCategories(q: string) {
  assertUrl();
  return directus.request(
    readItems('categories', {
      search: q,
      limit: 3,
      fields: ['id', 'name', 'slug'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function globalSearchInstructors(q: string) {
  assertUrl();
  return directus.request(
    readItems('directus_users', {
      filter: { is_instructor: { _eq: true } },
      search: q,
      limit: 3,
      fields: ['id', 'first_name', 'last_name', 'headline'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function tryReadMe() {
  if (!getDirectusUrl()) return null;
  try {
    return (await directus.request(readMe({ fields: ['id'] }))) as UnknownRecord;
  } catch {
    return null;
  }
}
