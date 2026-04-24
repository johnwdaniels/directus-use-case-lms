import type { UnknownRecord } from '@/api/public';
import type {
  AssignmentRef,
  Course,
  CourseWithCurriculum,
  Lesson,
  LessonType,
  QuizRef,
  VideoCaptionTrack,
  VideoSource,
} from '@/types/lms';

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number.parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeCaptions(v: unknown): VideoCaptionTrack[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  return v.map((row) => {
    const r = row as UnknownRecord;
    const file = r.directus_files_id ?? r.file_id ?? r.file;
    return {
      file_id: typeof file === 'object' && file && 'id' in file ? String((file as { id: string }).id) : (file as string | undefined),
      language_code: String(r.language_code ?? 'en'),
      label: String(r.label ?? 'Captions'),
      is_default: Boolean(r.is_default),
    };
  });
}

function mapQuizRef(v: unknown): QuizRef | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as UnknownRecord;
  if (!r.id) return null;
  return {
    id: String(r.id),
    title: r.title != null ? String(r.title) : null,
    description: r.description != null ? String(r.description) : null,
    time_limit_minutes: num(r.time_limit_minutes),
    max_attempts: num(r.max_attempts),
    passing_score: num(r.passing_score),
  };
}

function mapAssignmentRef(v: unknown): AssignmentRef | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as UnknownRecord;
  if (!r.id) return null;
  return {
    id: String(r.id),
    title: r.title != null ? String(r.title) : null,
    description: r.description != null ? String(r.description) : null,
    instructions: r.instructions != null ? String(r.instructions) : null,
    due_date: r.due_date != null ? String(r.due_date) : null,
    max_points: r.max_points as AssignmentRef['max_points'],
  };
}

export function mapLesson(raw: UnknownRecord): Lesson {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    slug: raw.slug != null ? String(raw.slug) : null,
    lesson_type: (raw.lesson_type as LessonType) ?? 'text',
    sort_order: num(raw.sort_order),
    duration_minutes: num(raw.duration_minutes),
    is_preview: raw.is_preview == null ? null : Boolean(raw.is_preview),
    video_source: (raw.video_source as VideoSource) ?? null,
    video_youtube_id: raw.video_youtube_id != null ? String(raw.video_youtube_id) : null,
    video_vimeo_id: raw.video_vimeo_id != null ? String(raw.video_vimeo_id) : null,
    video_file: (raw.video_file as Lesson['video_file']) ?? null,
    video_url: raw.video_url != null ? String(raw.video_url) : null,
    video_duration_seconds: num(raw.video_duration_seconds),
    video_thumbnail: (raw.video_thumbnail as Lesson['video_thumbnail']) ?? null,
    video_captions: normalizeCaptions(raw.video_captions),
    video_chapters: (raw.video_chapters as Lesson['video_chapters']) ?? null,
    video_transcript: raw.video_transcript != null ? String(raw.video_transcript) : null,
    resume_from_last_position: raw.resume_from_last_position == null ? null : Boolean(raw.resume_from_last_position),
    completion_threshold: num(raw.completion_threshold),
    text_body: raw.text_body != null ? String(raw.text_body) : null,
    pdf_file: (raw.pdf_file as Lesson['pdf_file']) ?? null,
    quiz:
      typeof raw.quiz === 'string'
        ? { id: raw.quiz }
        : mapQuizRef(raw.quiz) ?? (raw.quiz as Lesson['quiz']),
    assignment:
      typeof raw.assignment === 'string'
        ? { id: raw.assignment }
        : mapAssignmentRef(raw.assignment) ?? (raw.assignment as Lesson['assignment']),
    external_url: raw.external_url != null ? String(raw.external_url) : null,
    allow_embed: raw.allow_embed == null ? null : Boolean(raw.allow_embed),
    resources: raw.resources,
  };
}

export function mapToCourse(raw: UnknownRecord): Course {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    slug: String(raw.slug ?? ''),
    subtitle: raw.subtitle != null ? String(raw.subtitle) : null,
    description: raw.description != null ? String(raw.description) : null,
    duration_minutes: num(raw.duration_minutes),
    difficulty: raw.difficulty != null ? String(raw.difficulty) : null,
    price: raw.price as Course['price'],
    currency: raw.currency != null ? String(raw.currency) : null,
    is_free: raw.is_free == null ? null : Boolean(raw.is_free),
    average_rating: raw.average_rating as Course['average_rating'],
    rating_count: num(raw.rating_count),
    cover_image: (raw.cover_image as Course['cover_image']) ?? null,
    category: (raw.category as Course['category']) ?? null,
    instructor: (raw.instructor as Course['instructor']) ?? null,
    default_completion_threshold: num(raw.default_completion_threshold),
    default_video_player_theme: (raw.default_video_player_theme as Course['default_video_player_theme']) ?? null,
  };
}

export function mapToCourseWithCurriculum(raw: UnknownRecord): CourseWithCurriculum {
  const base = mapToCourse(raw);
  const modules = (raw.modules as UnknownRecord[] | undefined)?.map((m) => ({
    id: String(m.id),
    title: String(m.title ?? ''),
    sort_order: num(m.sort_order),
    description: m.description != null ? String(m.description) : null,
    lessons: ((m.lessons as UnknownRecord[]) ?? []).map(mapLesson),
  }));
  return { ...base, modules };
}

export function parseLearningObjectives(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') {
    try {
      const j = JSON.parse(v) as unknown;
      return Array.isArray(j) ? j.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function instructorName(u: UnknownRecord | null | undefined): string {
  if (!u) return '';
  const fn = String((u as UnknownRecord).first_name ?? '').trim();
  const ln = String((u as UnknownRecord).last_name ?? '').trim();
  return `${fn} ${ln}`.trim() || 'Instructor';
}
