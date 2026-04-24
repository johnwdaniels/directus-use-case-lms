import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createItem } from '@directus/sdk';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ci = createItem as any;
import ReactPlayer from 'react-player/lazy';
import {
  createEnrollmentForCourse,
  fetchCourseBySlug,
  fetchEnrollment,
  fetchRatingHistogram,
  fetchReviewsForCourse,
} from '@/api/public';
import { directus } from '@/lib/directus';
import { mapToCourse, mapToCourseWithCurriculum, parseLearningObjectives, instructorName } from '@/lib/map-entities';
import type { UnknownRecord } from '@/api/public';
import type { CourseWithCurriculum, Lesson } from '@/types/lms';
import { RichText } from '@/components/content/RichText';
import { CurriculumOutline } from '@/components/courses/CurriculumOutline';
import { VideoPlayer } from '@/components/content/VideoPlayer';
import { StarRating } from '@/components/ui-custom/StarRating';
import { directusAssetUrl } from '@/lib/assets';
import { formatCurrency, formatDurationMinutes } from '@/lib/format';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Share2, X } from 'lucide-react';

function lessonStats(course: CourseWithCurriculum) {
  let lessons = 0;
  let minutes = 0;
  for (const m of course.modules ?? []) {
    for (const l of m.lessons ?? []) {
      lessons += 1;
      minutes += l.duration_minutes ?? 0;
    }
  }
  return { lessons, hours: minutes / 60 };
}

function collectTags(raw: UnknownRecord): { name: string; slug: string }[] {
  const tags = raw.tags as UnknownRecord[] | undefined;
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => {
      const ct = t.course_tags_id as UnknownRecord | undefined;
      if (!ct) return null;
      return { name: String(ct.name ?? ''), slug: String(ct.slug ?? '') };
    })
    .filter(Boolean) as { name: string; slug: string }[];
}

export default function CourseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');

  const courseQuery = useQuery({
    queryKey: ['course', slug],
    enabled: Boolean(slug),
    queryFn: () => fetchCourseBySlug(slug!),
  });

  const raw = courseQuery.data as UnknownRecord | null | undefined;
  const course = useMemo(() => (raw ? mapToCourseWithCurriculum(raw) : null), [raw]);
  const courseFlat = useMemo(() => (raw ? mapToCourse(raw) : null), [raw]);

  const enrollment = useQuery({
    queryKey: ['enrollment', slug, user?.id],
    enabled: Boolean(course?.id && user?.id && slug),
    queryFn: () => fetchEnrollment(course!.id, user!.id),
  });

  const enrollMut = useMutation({
    mutationFn: () => createEnrollmentForCourse(course!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollment', slug] });
      navigate(`/learn/${course!.slug}`);
    },
  });

  const reviews = useQuery({
    queryKey: ['reviews', course?.id, reviewPage],
    enabled: Boolean(course?.id),
    queryFn: () => fetchReviewsForCourse(course!.id, reviewPage, 8),
  });

  const histogram = useQuery({
    queryKey: ['reviews-hist', course?.id],
    enabled: Boolean(course?.id),
    queryFn: () => fetchRatingHistogram(course!.id),
  });

  const stats = course ? lessonStats(course) : { lessons: 0, hours: 0 };
  const objectives = raw ? parseLearningObjectives(raw.learning_objectives) : [];
  const prereqs = (raw?.prerequisites as UnknownRecord[] | undefined)?.map((p) => p.courses_id).filter(Boolean) as UnknownRecord[];
  const tags = raw ? collectTags(raw) : [];
  const co = (raw?.co_instructors as UnknownRecord[] | undefined)
    ?.map((j) => j.directus_users_id as UnknownRecord | undefined)
    .filter(Boolean) as UnknownRecord[];

  const progressPct = Number((enrollment.data as UnknownRecord | undefined)?.progress_pct ?? 0);
  const isEnrolled = Boolean(enrollment.data);
  const canReview = Boolean(user && isEnrolled && progressPct >= 50);

  const reviewMut = useMutation({
    mutationFn: async () => {
      await directus.request(
        ci('reviews', {
          course: course!.id,
          rating: reviewRating,
          title: reviewTitle || 'Review',
          body: reviewBody,
        }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', course!.id] });
      setReviewTitle('');
      setReviewBody('');
    },
  });

  if (!slug?.trim()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Invalid course link</h1>
        <p className="mt-2 text-sm text-slate-600">The URL is missing a course slug (for example use /courses/your-course-slug).</p>
        <Link to="/courses" className="mt-6 inline-block text-indigo-700">
          Back to catalog
        </Link>
      </div>
    );
  }

  if (courseQuery.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Could not load this course</h1>
        <p className="mt-2 text-sm text-slate-600">
          The catalog request failed (network, CORS, or Directus permissions). If you are not logged in, confirm the{' '}
          <strong>Public</strong> role can read these course fields and related modules/lessons.
        </p>
        <Link to="/courses" className="mt-6 inline-block text-indigo-700">
          Back to catalog
        </Link>
      </div>
    );
  }

  if (!courseQuery.isLoading && !course) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Course not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          No course matches <span className="font-mono text-slate-800">{slug}</span>. It may be unpublished, removed, or
          not visible to anonymous users.
        </p>
        <Link to="/courses" className="mt-6 inline-block text-indigo-700">
          Back to catalog
        </Link>
      </div>
    );
  }

  if (!course || !courseFlat || !raw) {
    return <div className="p-8 text-center text-slate-600">Loading…</div>;
  }

  const cat = course.category;
  const inst = raw.instructor as UnknownRecord | undefined;
  const trailer = raw.trailer_video_url != null ? String(raw.trailer_video_url) : '';
  const updated = raw.date_updated != null ? new Date(String(raw.date_updated)) : null;
  const enrollUrl = `/signup?then=${encodeURIComponent(`/courses/${course.slug}`)}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-10 lg:flex-row">
        <article className="min-w-0 flex-1 space-y-8">
          <nav className="text-sm text-slate-500">
            {cat?.slug ? (
              <Link to={`/categories/${encodeURIComponent(cat.slug)}`} className="hover:text-indigo-700">
                {cat.name}
              </Link>
            ) : (
              <span>Category</span>
            )}
            <span className="mx-2">/</span>
            <span className="text-slate-800">{course.title}</span>
          </nav>

          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{course.title}</h1>
            {course.subtitle ? <p className="text-lg text-slate-600">{course.subtitle}</p> : null}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <StarRating
                mode="display"
                value={Number(course.average_rating) || 0}
                count={course.rating_count ?? 0}
              />
              <span>{raw.enrollment_count != null ? `${raw.enrollment_count} enrollments` : ''}</span>
              {updated ? <span>Updated {format(updated, 'MMM d, yyyy')}</span> : null}
            </div>
            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t.slug} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {t.name}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          {inst ? (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100">
                {directusAssetUrl(inst.avatar as never) ? (
                  <img src={directusAssetUrl(inst.avatar as never)} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div>
                <p className="text-sm text-slate-500">Created by</p>
                <Link to={`/instructors/${encodeURIComponent(String(inst.id))}`} className="font-semibold text-indigo-800 hover:underline">
                  {instructorName(inst)}
                </Link>
              </div>
            </div>
          ) : null}

          {co.length ? (
            <p className="text-sm text-slate-600">
              With{' '}
              {co.map((c, i) => (
                <span key={String(c.id)}>
                  {i > 0 ? ', ' : ''}
                  <Link className="text-indigo-700 hover:underline" to={`/instructors/${encodeURIComponent(String(c.id))}`}>
                    {instructorName(c)}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}

          {trailer ? (
            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">Trailer</h2>
              <div className="aspect-video overflow-hidden rounded-xl bg-black">
                <ReactPlayer url={trailer} width="100%" height="100%" controls />
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">About this course</h2>
            <RichText content={String(raw.description ?? '')} />
          </section>

          {objectives.length ? (
            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">What you will learn</h2>
              <ul className="list-inside list-disc space-y-1 text-slate-700">
                {objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {prereqs?.length ? (
            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">Prerequisites</h2>
              <ul className="space-y-1">
                {prereqs.map((p) => (
                  <li key={String(p.id)}>
                    <Link to={`/courses/${encodeURIComponent(String(p.slug))}`} className="text-indigo-700 hover:underline">
                      {String(p.title)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Curriculum</h2>
            <p className="mb-3 text-sm text-slate-600">
              {stats.lessons} lessons · {formatDurationMinutes(stats.hours * 60)} total
            </p>
            <CurriculumOutline
              course={course}
              variant="preview"
              isEnrolled={isEnrolled}
              onLessonClick={(lessonId) => {
                const flat = (course.modules ?? []).flatMap((m) => m.lessons ?? []);
                const les = flat.find((l) => l.id === lessonId);
                if (les?.lesson_type === 'video' && les.is_preview) setPreviewLesson(les);
              }}
            />
            <p className="mt-2 text-xs text-slate-500">Preview lessons are only available on free courses (per platform rules).</p>
          </section>

          {inst ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900">About the instructor</h2>
              <p className="mt-1 font-medium text-slate-800">{instructorName(inst)}</p>
              {inst.headline ? <p className="text-sm text-slate-600">{String(inst.headline)}</p> : null}
              {inst.bio ? <RichText className="prose-sm mt-3" content={String(inst.bio)} /> : null}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
                <span>{Number(inst.total_students ?? 0)} students</span>
                <span>{Number(inst.total_courses ?? 0)} courses</span>
                <span>Rating {inst.average_rating != null ? String(inst.average_rating) : '—'}</span>
              </div>
              <Link to={`/instructors/${encodeURIComponent(String(inst.id))}`} className="mt-4 inline-block text-sm font-medium text-indigo-700">
                More from this instructor
              </Link>
            </section>
          ) : null}

          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Reviews</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = histogram.data?.[star] ?? 0;
                  const max = Math.max(1, ...Object.values(histogram.data ?? {}));
                  const w = Math.round((c / max) * 100);
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="w-12">{star}★</span>
                      <div className="h-2 flex-1 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-amber-400" style={{ width: `${w}%` }} />
                      </div>
                      <span className="w-8 text-right text-slate-500">{c}</span>
                    </div>
                  );
                })}
              </div>
              {user && isEnrolled ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-medium text-slate-900">Leave a review</h3>
                  {!canReview ? (
                    <p className="mt-2 text-sm text-slate-600">
                      You can leave a review once you pass 50 percent of the course ({Math.round(progressPct)}% so far).
                    </p>
                  ) : (
                    <form
                      className="mt-3 space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        reviewMut.mutate();
                      }}
                    >
                      <StarRating mode="input" value={reviewRating} onChange={setReviewRating} />
                      <input
                        className="w-full rounded border px-2 py-1 text-sm"
                        placeholder="Title"
                        value={reviewTitle}
                        onChange={(e) => setReviewTitle(e.target.value)}
                      />
                      <textarea
                        className="w-full rounded border px-2 py-2 text-sm"
                        rows={3}
                        placeholder="Share your experience"
                        value={reviewBody}
                        onChange={(e) => setReviewBody(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={reviewMut.isPending || !reviewBody.trim()}
                        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                      >
                        Submit review
                      </button>
                      {reviewMut.isError ? <p className="text-xs text-rose-600">Could not submit (check permissions).</p> : null}
                    </form>
                  )}
                </div>
              ) : null}
            </div>
            <ul className="mt-6 space-y-4">
              {(reviews.data?.reviews ?? []).map((r: UnknownRecord) => (
                <li key={String(r.id)} className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                  <StarRating mode="display" value={Number(r.rating)} />
                  {r.title ? <p className="mt-1 font-medium text-slate-900">{String(r.title)}</p> : null}
                  <p className="mt-1 text-sm text-slate-700">{String(r.body ?? '')}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {instructorName(r.user as UnknownRecord)} · {r.date_created ? format(new Date(String(r.date_created)), 'MMM d, yyyy') : ''}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                disabled={reviewPage <= 1}
                onClick={() => setReviewPage((p) => p - 1)}
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                disabled={reviewPage * 8 >= (reviews.data?.total ?? 0)}
                onClick={() => setReviewPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </article>

        <aside className="w-full shrink-0 lg:w-[350px]">
          <div className="sticky top-24 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="aspect-video overflow-hidden rounded-lg bg-slate-100">
              {directusAssetUrl(course.cover_image) ? (
                <img src={directusAssetUrl(course.cover_image)!} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {course.is_free || Number(course.price) === 0 ? (
                <span className="rounded bg-emerald-100 px-2 py-1 text-lg text-emerald-800">Free</span>
              ) : (
                formatCurrency(Number(course.price), course.currency ?? 'USD')
              )}
            </div>
            {!user ? (
              <Link
                to={enrollUrl}
                className="block w-full rounded-lg bg-indigo-600 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Sign up to enroll
              </Link>
            ) : isEnrolled ? (
              <Link
                to={`/learn/${encodeURIComponent(course.slug)}`}
                className="block w-full rounded-lg bg-slate-900 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
              >
                Continue learning
              </Link>
            ) : (
              <button
                type="button"
                disabled={enrollMut.isPending}
                onClick={() => enrollMut.mutate()}
                className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {enrollMut.isPending ? 'Enrolling…' : 'Enroll now'}
              </button>
            )}
            {enrollMut.isError ? <p className="text-xs text-rose-600">Enrollment failed. You may already be enrolled.</p> : null}
            <ul className="space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
              <li>{stats.lessons} lessons</li>
              <li>{stats.hours.toFixed(1)} hours of content</li>
              <li>Certificate of completion on finishing the course</li>
              <li>Full lifetime access</li>
              <li>Downloadable resources (when the instructor attaches them)</li>
            </ul>
            <div className="flex gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(window.location.href);
                }}
              >
                <Share2 className="h-3.5 w-3.5" />
                Copy link
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator ? (
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                  onClick={() => void navigator.share({ title: course.title, url: window.location.href })}
                >
                  Share
                </button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {previewLesson ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-4xl rounded-xl bg-black p-2 shadow-2xl">
            <button
              type="button"
              aria-label="Close preview"
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-800 shadow"
              onClick={() => setPreviewLesson(null)}
            >
              <X className="h-5 w-5" />
            </button>
            <VideoPlayer
              lesson={previewLesson}
              course={{
                title: course.title,
                slug: course.slug,
                default_completion_threshold: course.default_completion_threshold ?? 90,
                default_video_player_theme:
                  (raw.default_video_player_theme as 'light' | 'dark' | null | undefined) ?? 'dark',
              }}
              disableProgressTracking
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
