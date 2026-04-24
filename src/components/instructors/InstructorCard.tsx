import { Link } from 'react-router-dom';
import { directusAssetUrl } from '@/lib/assets';
import { StarRating } from '@/components/ui-custom/StarRating';
import { cn } from '@/lib/cn';

export type InstructorCardProps = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | { id: string } | null;
  headline?: string | null;
  totalStudents?: number | null;
  totalCourses?: number | null;
  averageRating?: number | string | null;
  className?: string;
};

export function InstructorCard({
  id,
  firstName,
  lastName,
  avatar,
  headline,
  totalStudents,
  totalCourses,
  averageRating,
  className,
}: InstructorCardProps) {
  const name = `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Instructor';
  const img = directusAssetUrl(avatar ?? null);
  const rating =
    averageRating == null ? 0 : typeof averageRating === 'string' ? Number.parseFloat(averageRating) : averageRating;
  const r = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;

  return (
    <Link
      to={`/instructors/${encodeURIComponent(id)}`}
      className={cn(
        'flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
          {img ? <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{name}</p>
          {headline ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{headline}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>{totalStudents ?? 0} students</span>
        <span>{totalCourses ?? 0} courses</span>
      </div>
      <div className="mt-2">
        <StarRating mode="display" value={r} />
      </div>
    </Link>
  );
}
