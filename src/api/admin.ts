import { aggregate, createItem, deleteItem, readItems, updateItem, uploadFiles } from '@directus/sdk';
import { directus, hasDirectusEnv } from '@/lib/directus';
import type { UnknownRecord } from '@/api/public';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ri = readItems as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const agg = aggregate as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ci = createItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ui = updateItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const di = deleteItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const uf = uploadFiles as any;

function assertUrl() {
  if (!hasDirectusEnv()) throw new Error('VITE_DIRECTUS_URL is not set');
}

function countFromAgg(row: unknown): number {
  const r = (row ?? {}) as UnknownRecord;
  const n = Number(r.count ?? r['count(*)'] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchAdminDashboardData() {
  assertUrl();
  const [usersByRole, coursesByStatus, enrollmentsAgg, certificatesAgg, recentEnrollments, recentPublishes, recentCerts] =
    await Promise.all([
      directus.request(
        agg('directus_users', {
          aggregate: { count: '*' },
          groupBy: ['role.name'],
        }),
      ) as Promise<UnknownRecord[]>,
      directus.request(
        agg('courses', {
          aggregate: { count: '*' },
          groupBy: ['status'],
        }),
      ) as Promise<UnknownRecord[]>,
      directus.request(agg('enrollments', { aggregate: { count: '*' } })) as Promise<UnknownRecord[]>,
      directus.request(agg('certificates', { aggregate: { count: '*' } })) as Promise<UnknownRecord[]>,
      directus.request(
        ri('enrollments', {
          sort: ['-date_created'],
          limit: 20,
          fields: ['id', 'date_created', 'user.first_name', 'user.last_name', 'user.email', 'course.title'],
        }),
      ) as Promise<UnknownRecord[]>,
      directus.request(
        ri('courses', {
          sort: ['-published_at'],
          filter: { published_at: { _nnull: true } },
          limit: 20,
          fields: ['id', 'published_at', 'title', 'status'],
        }),
      ) as Promise<UnknownRecord[]>,
      directus.request(
        ri('certificates', {
          sort: ['-issued_at'],
          limit: 20,
          fields: ['id', 'issued_at', 'verification_code', 'user.first_name', 'user.last_name', 'course.title'],
        }),
      ) as Promise<UnknownRecord[]>,
    ]);

  const activity = [
    ...recentEnrollments.map((row) => ({
      id: `enr-${String(row.id)}`,
      type: 'enrollment',
      at: String(row.date_created ?? ''),
      row,
    })),
    ...recentPublishes.map((row) => ({
      id: `pub-${String(row.id)}`,
      type: 'publish',
      at: String(row.published_at ?? ''),
      row,
    })),
    ...recentCerts.map((row) => ({
      id: `crt-${String(row.id)}`,
      type: 'certification',
      at: String(row.issued_at ?? ''),
      row,
    })),
  ]
    .filter((x) => x.at)
    .sort((a, b) => (a.at > b.at ? -1 : 1))
    .slice(0, 20);

  return {
    usersByRole,
    coursesByStatus,
    totalEnrollments: countFromAgg(enrollmentsAgg[0]),
    totalCertificates: countFromAgg(certificatesAgg[0]),
    totalRevenuePlaceholder: 0,
    activity,
  };
}

export async function fetchAdminUsers(filters?: { role?: string; status?: string; createdAt?: string }) {
  assertUrl();
  const and: UnknownRecord[] = [];
  if (filters?.role) and.push({ role: { _eq: filters.role } });
  if (filters?.status) and.push({ status: { _eq: filters.status } });
  if (filters?.createdAt) and.push({ date_created: { _gte: filters.createdAt } });
  return directus.request(
    ri('directus_users', {
      filter: and.length ? { _and: and } : undefined,
      sort: ['-date_created'],
      limit: 500,
      fields: ['*', 'role.id', 'role.name'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function createAdminUser(payload: UnknownRecord) {
  assertUrl();
  return directus.request(ci('directus_users', payload)) as Promise<UnknownRecord>;
}

export async function updateAdminUser(userId: string, payload: UnknownRecord) {
  assertUrl();
  return directus.request(ui('directus_users', userId, payload)) as Promise<UnknownRecord>;
}

export async function disableAdminUser(userId: string) {
  assertUrl();
  return directus.request(ui('directus_users', userId, { status: 'inactive' })) as Promise<UnknownRecord>;
}

export async function fetchAdminCategories() {
  assertUrl();
  return directus.request(
    ri('categories', {
      sort: ['sort_order', 'name'],
      limit: -1,
      fields: ['id', 'name', 'slug', 'description', 'parent', 'sort_order'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function createCategory(payload: UnknownRecord) {
  assertUrl();
  return directus.request(ci('categories', payload)) as Promise<UnknownRecord>;
}

export async function updateCategory(id: string, payload: UnknownRecord) {
  assertUrl();
  return directus.request(ui('categories', id, payload)) as Promise<UnknownRecord>;
}

export async function deleteCategory(id: string) {
  assertUrl();
  return directus.request(di('categories', id));
}

export async function fetchAdminBadges() {
  assertUrl();
  return directus.request(
    ri('badges', {
      sort: ['name'],
      limit: -1,
      fields: ['id', 'name', 'description', 'icon', 'color', 'criteria_type', 'criteria_value'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function createBadge(payload: UnknownRecord) {
  assertUrl();
  return directus.request(ci('badges', payload)) as Promise<UnknownRecord>;
}

export async function updateBadge(id: string, payload: UnknownRecord) {
  assertUrl();
  return directus.request(ui('badges', id, payload)) as Promise<UnknownRecord>;
}

export async function deleteBadge(id: string) {
  assertUrl();
  return directus.request(di('badges', id));
}

export async function assignManualBadgeToUser(payload: { user: string; badge: string; awarded_context?: string }) {
  assertUrl();
  return directus.request(
    ci('user_badges', {
      user: payload.user,
      badge: payload.badge,
      awarded_context: payload.awarded_context ?? 'Manual assignment by admin',
    }),
  ) as Promise<UnknownRecord>;
}

export async function uploadAdminFile(file: File) {
  assertUrl();
  const fd = new FormData();
  fd.append('file', file);
  const created = await directus.request(uf(fd));
  const row = Array.isArray(created) ? created[0] : created;
  return row as UnknownRecord;
}

export async function fetchCertificateTemplates() {
  assertUrl();
  return directus.request(
    ri('certificate_templates', {
      sort: ['-is_default', 'name'],
      limit: -1,
      fields: [
        'id',
        'name',
        'html_template',
        'background_image',
        'accent_color',
        'issuer_name',
        'issuer_title',
        'signature_image',
        'is_default',
        'date_updated',
      ],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function createCertificateTemplate(payload: UnknownRecord) {
  assertUrl();
  return directus.request(ci('certificate_templates', payload)) as Promise<UnknownRecord>;
}

export async function updateCertificateTemplate(id: string, payload: UnknownRecord) {
  assertUrl();
  return directus.request(ui('certificate_templates', id, payload)) as Promise<UnknownRecord>;
}

export async function fetchReviewsForModeration(filters?: { approved?: boolean; course?: string; rating?: string }) {
  assertUrl();
  const and: UnknownRecord[] = [];
  if (filters?.approved != null) and.push({ is_approved: { _eq: filters.approved } });
  if (filters?.course) and.push({ course: { _eq: filters.course } });
  if (filters?.rating) and.push({ rating: { _eq: Number(filters.rating) } });

  return directus.request(
    ri('reviews', {
      filter: and.length ? { _and: and } : undefined,
      sort: ['-date_created'],
      limit: 200,
      fields: ['id', 'rating', 'title', 'body', 'is_approved', 'date_created', 'course.id', 'course.title', 'user.first_name', 'user.last_name'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function updateReview(id: string, payload: UnknownRecord) {
  assertUrl();
  return directus.request(ui('reviews', id, payload)) as Promise<UnknownRecord>;
}

export async function deleteReview(id: string) {
  assertUrl();
  return directus.request(di('reviews', id));
}

export async function fetchAdminCoursesLite() {
  assertUrl();
  return directus.request(ri('courses', { sort: ['title'], limit: -1, fields: ['id', 'title', 'slug'] })) as Promise<
    UnknownRecord[]
  >;
}

export async function fetchSiteAnnouncements() {
  assertUrl();
  return directus.request(
    ri('announcements', {
      filter: { course: { _null: true } },
      sort: ['-published_at'],
      limit: 100,
      fields: ['id', 'title', 'body', 'is_pinned', 'published_at', 'author.first_name', 'author.last_name'],
    }),
  ) as Promise<UnknownRecord[]>;
}

export async function createSiteAnnouncement(payload: UnknownRecord) {
  assertUrl();
  return directus.request(
    ci('announcements', {
      ...payload,
      course: null,
      published_at: payload.published_at ?? new Date().toISOString(),
    }),
  ) as Promise<UnknownRecord>;
}
