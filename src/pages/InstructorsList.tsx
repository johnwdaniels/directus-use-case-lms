import { useQuery } from '@tanstack/react-query';
import { fetchInstructorsPage } from '@/api/public';
import { hasDirectusEnv } from '@/lib/directus';
import type { UnknownRecord } from '@/api/public';
import { InstructorCard, type InstructorCardProps } from '@/components/instructors/InstructorCard';

export default function InstructorsList() {
  const hasUrl = hasDirectusEnv();
  const q = useQuery({
    queryKey: ['instructors', 'list'],
    enabled: hasUrl,
    queryFn: () => fetchInstructorsPage(48),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Instructors</h1>
        <p className="mt-2 text-slate-600">Learn from experienced teachers across every topic.</p>
      </div>
      {!hasUrl ? <p className="text-sm text-amber-800">Set VITE_DIRECTUS_URL to load instructors.</p> : null}
      {q.isError ? <p className="text-sm text-rose-600">Could not load instructors.</p> : null}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((row: UnknownRecord) => (
          <InstructorCard
            key={String(row.id)}
            id={String(row.id)}
            firstName={row.first_name != null ? String(row.first_name) : null}
            lastName={row.last_name != null ? String(row.last_name) : null}
            avatar={row.avatar as InstructorCardProps['avatar']}
            headline={row.headline != null ? String(row.headline) : null}
            totalStudents={row.total_students != null ? Number(row.total_students) : null}
            totalCourses={row.total_courses != null ? Number(row.total_courses) : null}
            averageRating={row.average_rating as InstructorCardProps['averageRating']}
          />
        ))}
      </div>
    </div>
  );
}
