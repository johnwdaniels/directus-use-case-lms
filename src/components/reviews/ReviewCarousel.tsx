import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { StarRating } from '@/components/ui-custom/StarRating';
import { cn } from '@/lib/cn';

export type ReviewSlide = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  author: string;
  courseTitle?: string | null;
};

export type ReviewCarouselProps = {
  reviews: ReviewSlide[];
  className?: string;
};

export function ReviewCarousel({ reviews, className }: ReviewCarouselProps) {
  const [i, setI] = useState(0);
  const n = reviews.length;
  const go = useCallback(
    (dir: -1 | 1) => {
      if (!n) return;
      setI((v) => (v + dir + n) % n);
    },
    [n],
  );

  if (!n) {
    return (
      <p className={cn('rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500', className)}>
        No testimonials yet.
      </p>
    );
  }

  const r = reviews[i]!;
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 shadow-sm', className)}>
      <Quote className="absolute right-6 top-6 h-10 w-10 text-indigo-100" aria-hidden />
      <div className="relative mx-auto max-w-2xl text-center">
        <StarRating mode="display" value={r.rating} />
        {r.title ? <h3 className="mt-4 text-lg font-semibold text-slate-900">{r.title}</h3> : null}
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{r.body}</p>
        <p className="mt-4 text-sm font-medium text-slate-900">{r.author}</p>
        {r.courseTitle ? <p className="text-xs text-slate-500">on {r.courseTitle}</p> : null}
      </div>
      {n > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Previous testimonial"
            className="rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-white"
            onClick={() => go(-1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xs text-slate-500">
            {i + 1} / {n}
          </span>
          <button
            type="button"
            aria-label="Next testimonial"
            className="rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-white"
            onClick={() => go(1)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
