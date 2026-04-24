import { createItem, readItems, updateItem } from '@directus/sdk';
import { directus, hasDirectusEnv } from '@/lib/directus';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ri = readItems as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ci = createItem as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ui = updateItem as any;

const DEBOUNCE_MS = 2000;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingPayloads = new Map<string, Record<string, unknown>>();

function debKey(lessonId: string, enrollmentId: string) {
  return `${lessonId}:${enrollmentId}`;
}

async function runUpsert(
  lessonId: string,
  enrollmentId: string,
  userId: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!hasDirectusEnv()) return;
  const existing = await directus.request(
    ri('lesson_progress', {
      filter: { _and: [{ lesson: { _eq: lessonId } }, { user: { _eq: userId } }] },
      limit: 1,
      fields: ['id', 'status'],
    }),
  );
  const row = (Array.isArray(existing) ? existing[0] : null) as { id: string; status?: string } | null;
  const nowIso = new Date().toISOString();
  const incomingStatus = data.status as string | undefined;
  const resolvedStatus =
    incomingStatus ??
    (row?.status === 'completed'
      ? 'completed'
      : row?.status === 'in_progress'
        ? 'in_progress'
        : 'in_progress');
  const patch: Record<string, unknown> = {
    ...data,
    status: resolvedStatus,
    last_watched_at: data.last_watched_at ?? nowIso,
  };

  if (row?.id) {
    await directus.request(ui('lesson_progress', row.id, patch));
    return;
  }

  await directus.request(
    ci('lesson_progress', {
      user: userId,
      lesson: lessonId,
      enrollment: enrollmentId,
      status: resolvedStatus,
      last_position_seconds: Number(patch.last_position_seconds ?? 0),
      watched_seconds: Number(patch.watched_seconds ?? 0),
      time_spent_seconds: Number(patch.time_spent_seconds ?? 0),
      last_watched_at: patch.last_watched_at,
      completed_at: patch.completed_at ?? null,
    }),
  );
}

/**
 * Merges writes for the same (lesson, enrollment) and commits after 2s idle to coalesce
 * burst events (e.g. pause + visibility hidden). Pair with VideoPlayer’s 15s + flush cadence.
 */
export function upsertLessonProgress(
  lessonId: string,
  enrollmentId: string,
  userId: string,
  data: Record<string, unknown>,
): void {
  const k = debKey(lessonId, enrollmentId);
  const prev = pendingPayloads.get(k) ?? {};
  pendingPayloads.set(k, { ...prev, ...data });
  const t = debounceTimers.get(k);
  if (t) clearTimeout(t);
  debounceTimers.set(
    k,
    setTimeout(() => {
      debounceTimers.delete(k);
      const merged = pendingPayloads.get(k);
      pendingPayloads.delete(k);
      if (!merged) return;
      void runUpsert(lessonId, enrollmentId, userId, merged).catch(() => {});
    }, DEBOUNCE_MS),
  );
}

/** Flush any debounced payload immediately (e.g. before mark complete or unmount). */
export async function flushLessonProgressDebounced(
  lessonId: string,
  enrollmentId: string,
  userId: string,
): Promise<void> {
  const k = debKey(lessonId, enrollmentId);
  const t = debounceTimers.get(k);
  if (t) clearTimeout(t);
  debounceTimers.delete(k);
  const merged = pendingPayloads.get(k);
  pendingPayloads.delete(k);
  if (!merged) return;
  await runUpsert(lessonId, enrollmentId, userId, merged);
}

export async function markLessonComplete(
  lessonId: string,
  enrollmentId: string,
  userId: string,
): Promise<void> {
  await flushLessonProgressDebounced(lessonId, enrollmentId, userId);
  const nowIso = new Date().toISOString();
  await runUpsert(lessonId, enrollmentId, userId, {
    status: 'completed',
    completed_at: nowIso,
    last_watched_at: nowIso,
  });
}
