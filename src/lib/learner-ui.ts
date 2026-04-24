import type { UnknownRecord } from '@/api/public';
import { mapToCourse } from '@/lib/map-entities';
import type { Course } from '@/types/lms';

export function mapEnrollmentCourse(row: UnknownRecord): Course | null {
  const c = row.course;
  if (!c || typeof c !== 'object') return null;
  const base = mapToCourse(c as UnknownRecord);
  return {
    ...base,
    progress_pct: Number(row.progress_pct ?? 0),
  };
}
