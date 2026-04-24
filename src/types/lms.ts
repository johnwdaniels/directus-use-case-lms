/** Directus-style user fragment for instructor display */
export type InstructorRef = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar?: string | { id: string } | null;
};

export type CategoryRef = {
  id?: string;
  name?: string;
  slug?: string;
};

export type FileRef = string | { id: string } | null | undefined;

export type Course = {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  duration_minutes?: number | null;
  difficulty?: string | null;
  price?: number | string | null;
  currency?: string | null;
  is_free?: boolean | null;
  average_rating?: number | string | null;
  rating_count?: number | null;
  cover_image?: FileRef;
  category?: CategoryRef | null;
  instructor?: InstructorRef | null;
  /** Used by `continue` variant */
  progress_pct?: number | null;
  last_lesson_title?: string | null;
  time_remaining_minutes?: number | null;
  default_completion_threshold?: number | null;
  default_video_player_theme?: 'light' | 'dark' | null;
};

export type LessonType =
  | 'video'
  | 'text'
  | 'pdf'
  | 'quiz'
  | 'assignment'
  | 'external_link';

export type VideoSource = 'youtube' | 'vimeo' | 'directus_file' | 'external_url';

export type VideoCaptionTrack = {
  id?: string;
  file_id?: string | { id: string };
  /** Some API shapes expose the related file as `file`. */
  file?: string | { id: string };
  language_code: string;
  label: string;
  is_default?: boolean;
};

export type VideoChapter = {
  start: number;
  title: string;
};

export type LessonResourceRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  file?: FileRef;
  external_url?: string | null;
};

export type QuizRef = {
  id: string;
  title?: string | null;
  description?: string | null;
  time_limit_minutes?: number | null;
  max_attempts?: number | null;
  passing_score?: number | null;
  show_correct_answers?: string | null;
  show_results_immediately?: boolean | null;
};

export type AssignmentRef = {
  id: string;
  title?: string | null;
  description?: string | null;
  instructions?: string | null;
  due_date?: string | null;
  max_points?: number | string | null;
  passing_score?: number | string | null;
  submission_types?: string[] | string | null;
  rubric?: string | null;
};

export type Lesson = {
  id: string;
  title: string;
  slug?: string | null;
  lesson_type: LessonType;
  module?: string | { id: string } | null;
  sort_order?: number | null;
  duration_minutes?: number | null;
  is_preview?: boolean | null;
  /** Video lesson fields */
  video_source?: VideoSource | null;
  video_youtube_id?: string | null;
  video_vimeo_id?: string | null;
  video_file?: string | { id: string } | null;
  video_url?: string | null;
  video_duration_seconds?: number | null;
  video_thumbnail?: FileRef;
  video_captions?: VideoCaptionTrack[] | null;
  video_chapters?: VideoChapter[] | string | null;
  video_transcript?: string | null;
  resume_from_last_position?: boolean | null;
  completion_threshold?: number | null;
  /** Text / PDF / quiz / assignment / external */
  text_body?: string | null;
  pdf_file?: FileRef;
  quiz?: QuizRef | string | { id: string } | null;
  assignment?: AssignmentRef | string | { id: string } | null;
  external_url?: string | null;
  allow_embed?: boolean | null;
  /** M2M extras (shape varies by API expansion). */
  resources?: unknown;
};

export type CourseModule = {
  id: string;
  title: string;
  description?: string | null;
  sort_order?: number | null;
  lessons?: Lesson[] | null;
};

export type CourseWithCurriculum = Course & {
  modules?: CourseModule[] | null;
};

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed';

export type LessonProgressRow = {
  id: string;
  lesson: string | { id: string };
  enrollment?: string | { id: string } | null;
  status?: LessonProgressStatus | null;
  last_position_seconds?: number | null;
  watched_seconds?: number | null;
  last_watched_at?: string | null;
  time_spent_seconds?: number | null;
  completed_at?: string | null;
};
