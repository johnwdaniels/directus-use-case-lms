import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import {
  fetchCoursesByCategoryId,
  fetchFeaturedCourses,
  fetchFeaturedInstructors,
  fetchNewCourses,
  fetchRootCategories,
  fetchTestimonialReviews,
} from '@/api/public';
import { hasDirectusEnv } from '@/lib/directus';
import { mapToCourse } from '@/lib/map-entities';
import { instructorName } from '@/lib/map-entities';
import type { UnknownRecord } from '@/api/public';
import { CategoryCard } from '@/components/categories/CategoryCard';
import { CourseCard } from '@/components/courses/CourseCard';
import { InstructorCard, type InstructorCardProps } from '@/components/instructors/InstructorCard';
import { ReviewCarousel, type ReviewSlide } from '@/components/reviews/ReviewCarousel';

function stripScrollRow(children: ReactNode) {
  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-1 scrollbar-thin sm:-mx-6 sm:px-6">{children}</div>
  );
}

/** Course cards need a real grid (not a single flex row) so they keep a readable width. */
function courseGrid(children: ReactNode) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
  );
}

export default function Home() {
  const hasUrl = hasDirectusEnv();

  const roots = useQuery({
    queryKey: ['categories', 'roots'],
    enabled: hasUrl,
    queryFn: () => fetchRootCategories(),
  });

  const featured = useQuery({
    queryKey: ['courses', 'featured-home'],
    enabled: hasUrl,
    queryFn: () => fetchFeaturedCourses(),
  });

  const newest = useQuery({
    queryKey: ['courses', 'new-home'],
    enabled: hasUrl,
    queryFn: () => fetchNewCourses(),
  });

  const firstRootId = roots.data?.[0]?.id as string | undefined;
  const firstRootName = roots.data?.[0]?.name as string | undefined;

  const popularCat = useQuery({
    queryKey: ['courses', 'popular-cat', firstRootId],
    enabled: hasUrl && Boolean(firstRootId),
    queryFn: () => fetchCoursesByCategoryId(firstRootId!, 12),
  });

  const instructors = useQuery({
    queryKey: ['instructors', 'featured-home'],
    enabled: hasUrl,
    queryFn: () => fetchFeaturedInstructors(6),
  });

  const reviews = useQuery({
    queryKey: ['reviews', 'testimonials'],
    enabled: hasUrl,
    queryFn: () => fetchTestimonialReviews(),
  });

  const slides: ReviewSlide[] = (reviews.data ?? []).map((r: UnknownRecord) => ({
    id: String(r.id),
    rating: Number(r.rating) || 5,
    title: r.title != null ? String(r.title) : null,
    body: r.body != null ? String(r.body) : null,
    author: instructorName(r.user as UnknownRecord),
    courseTitle: r.course && typeof r.course === 'object' ? String((r.course as UnknownRecord).title ?? '') : null,
  }));

  return (
    <div>
      {!hasUrl ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          Set <code className="rounded bg-amber-100 px-1">VITE_DIRECTUS_URL</code> in <code className="rounded bg-amber-100 px-1">.env.local</code> to load live catalog data.
        </div>
      ) : null}

      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 px-4 py-20 text-white sm:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-indigo-500 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-600 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Learn without limits</h1>
          <p className="mt-4 text-lg text-indigo-100/90">
            Self-paced courses from expert instructors—browse the catalog, preview lessons on free courses, and start
            in minutes.
          </p>
          <Link
            to="/courses"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-lg transition hover:bg-indigo-50"
          >
            Browse courses
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-16 sm:px-6">
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Browse by category</h2>
            <Link to="/categories" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
              View all
            </Link>
          </div>
          {stripScrollRow(
            (roots.data ?? []).map((c: UnknownRecord) => (
              <CategoryCard
                key={String(c.id)}
                name={String(c.name ?? '')}
                slug={String(c.slug ?? '')}
                icon={c.icon != null ? String(c.icon) : null}
                courseCount={c.course_count != null ? Number(c.course_count) : null}
              />
            )),
          )}
          {roots.isError ? <p className="mt-2 text-sm text-rose-600">Could not load categories.</p> : null}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Featured courses</h2>
          {courseGrid(
            (featured.data ?? []).map((raw) => <CourseCard key={String(raw.id)} course={mapToCourse(raw)} variant="catalog" />),
          )}
        </section>

        {firstRootId ? (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Popular in {firstRootName ?? 'this category'}
            </h2>
            {courseGrid(
              (popularCat.data ?? []).map((raw) => (
                <CourseCard key={String(raw.id)} course={mapToCourse(raw)} variant="catalog" />
              )),
            )}
          </section>
        ) : null}

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Newly added</h2>
          {courseGrid(
            (newest.data ?? []).map((raw) => <CourseCard key={String(raw.id)} course={mapToCourse(raw)} variant="catalog" />),
          )}
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">Featured instructors</h2>
            <Link to="/instructors" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(instructors.data ?? []).map((u: UnknownRecord) => (
              <InstructorCard
                key={String(u.id)}
                id={String(u.id)}
                firstName={u.first_name != null ? String(u.first_name) : null}
                lastName={u.last_name != null ? String(u.last_name) : null}
                avatar={u.avatar as InstructorCardProps['avatar']}
                headline={u.headline != null ? String(u.headline) : null}
                totalStudents={u.total_students != null ? Number(u.total_students) : null}
                totalCourses={u.total_courses != null ? Number(u.total_courses) : null}
                averageRating={u.average_rating as InstructorCardProps['averageRating']}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-900">What learners say</h2>
          <ReviewCarousel reviews={slides} />
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Start learning today</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            Create a free account to enroll, track progress, and earn certificates when you complete courses.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800"
          >
            Sign up free
          </Link>
        </section>
      </div>
    </div>
  );
}
