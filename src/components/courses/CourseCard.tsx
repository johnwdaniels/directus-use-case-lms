import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { directusAssetUrl } from '@/lib/assets';
import { formatCurrency, formatDurationMinutes } from '@/lib/format';
import type { Course } from '@/types/lms';

export type CourseCardVariant = 'catalog' | 'continue' | 'compact';

export type CourseCardProps = {
  course: Course;
  variant?: CourseCardVariant;
};

function instructorDisplayName(instructor: Course['instructor']): string {
  if (!instructor) return 'Instructor';
  const fn = instructor.first_name?.trim() ?? '';
  const ln = instructor.last_name?.trim() ?? '';
  const full = `${fn} ${ln}`.trim();
  return full || 'Instructor';
}

function instructorAvatarUrl(instructor: Course['instructor']): string | undefined {
  if (!instructor?.avatar) return undefined;
  return directusAssetUrl(instructor.avatar);
}

function coverUrl(course: Course): string | undefined {
  return directusAssetUrl(course.cover_image);
}

function ratingValue(course: Course): number {
  const v = course.average_rating;
  if (v == null) return 0;
  const n = typeof v === 'string' ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
}

function StarRatingDisplay({ value, count }: { value: number; count: number }) {
  const stars = useMemo(() => {
    const out: Array<'empty' | 'half' | 'full'> = [];
    for (let i = 1; i <= 5; i++) {
      if (value >= i) out.push('full');
      else if (value >= i - 0.5) out.push('half');
      else out.push('empty');
    }
    return out;
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5" aria-label={`Rating ${value.toFixed(1)} out of 5`}>
        {stars.map((kind, idx) => (
          <span key={idx} className="relative inline-flex h-4 w-4 text-amber-500">
            <Star className="h-4 w-4 text-slate-300" strokeWidth={1.5} aria-hidden />
            {kind !== 'empty' ? (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: kind === 'half' ? '50%' : '100%' }}
                aria-hidden
              >
                <Star className="h-4 w-4 fill-current text-amber-500" strokeWidth={1.5} />
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <span className="text-xs text-slate-500">
        {value > 0 ? value.toFixed(1) : '—'} ({count})
      </span>
    </div>
  );
}

export function CourseCard({ course, variant = 'catalog' }: CourseCardProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  const go = useCallback(() => {
    navigate(`/courses/${encodeURIComponent(course.slug)}`);
  }, [navigate, course.slug]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    },
    [go],
  );

  const cover = coverUrl(course);
  const instructorName = instructorDisplayName(course.instructor);
  const avatar = instructorAvatarUrl(course.instructor);
  const rating = ratingValue(course);
  const count = course.rating_count ?? 0;
  const free = Boolean(course.is_free);
  const priceNum = typeof course.price === 'string' ? Number.parseFloat(course.price) : course.price;
  const priceLabel =
    free || priceNum === 0 || priceNum == null || Number.isNaN(priceNum)
      ? 'Free'
      : formatCurrency(priceNum, course.currency ?? 'USD');

  if (variant === 'compact') {
    return (
      <article
        role="link"
        tabIndex={0}
        onClick={go}
        onKeyDown={onKeyDown}
        className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        aria-label={`Open course ${course.title}`}
      >
        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900">{course.title}</h3>
          <p className="truncate text-xs text-slate-600">{instructorName}</p>
        </div>
      </article>
    );
  }

  if (variant === 'continue') {
    const pct = Math.min(100, Math.max(0, course.progress_pct ?? 0));
    return (
      <article
        role="link"
        tabIndex={0}
        onClick={go}
        onKeyDown={onKeyDown}
        className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        aria-label={`Resume course ${course.title}`}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
        </div>
        <div className="space-y-3 p-4">
          <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{course.title}</h3>
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className="h-full rounded-full bg-slate-900 transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-slate-600">{pct}% complete</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
              Resume
            </span>
            {course.last_lesson_title ? (
              <span className="text-xs text-slate-600">
                Last: <span className="font-medium text-slate-800">{course.last_lesson_title}</span>
              </span>
            ) : null}
          </div>
          {course.time_remaining_minutes != null ? (
            <p className="text-xs text-slate-500">
              ~{formatDurationMinutes(course.time_remaining_minutes)} left
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  // catalog (default)
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition will-change-transform hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      aria-label={`Open course ${course.title}`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white transition-opacity duration-200 ${
            hovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <p className="line-clamp-3 text-xs leading-relaxed text-white/95">
            {course.description?.trim() || 'No description yet.'}
          </p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <h3 className="line-clamp-2 text-lg font-semibold text-slate-900">{course.title}</h3>
          {course.subtitle ? <p className="line-clamp-2 text-sm text-slate-600">{course.subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
          </div>
          <p className="min-w-0 truncate text-sm font-medium text-slate-800">{instructorName}</p>
        </div>
        <StarRatingDisplay value={rating} count={count} />
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              priceLabel === 'Free' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
            }`}
          >
            {priceLabel}
          </span>
          {course.duration_minutes != null ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {formatDurationMinutes(course.duration_minutes)}
            </span>
          ) : null}
          {course.difficulty ? (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
              {course.difficulty}
            </span>
          ) : null}
          {course.category?.name ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
              {course.category.name}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
