import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { fetchCoursesByInstructor, fetchInstructorById } from '@/api/public';
import { getDirectusUrl } from '@/lib/directus';
import { mapToCourse } from '@/lib/map-entities';
import { instructorName } from '@/lib/map-entities';
import type { UnknownRecord } from '@/api/public';
import { directusAssetUrl } from '@/lib/assets';
import { CourseCard } from '@/components/courses/CourseCard';

function socialLinks(ins: UnknownRecord) {
  const pairs: { label: string; url: string }[] = [];
  const tw = ins.social_twitter;
  const li = ins.social_linkedin;
  const yt = ins.social_youtube;
  const web = ins.social_website;
  if (typeof tw === 'string' && tw) pairs.push({ label: 'Twitter / X', url: tw.startsWith('http') ? tw : `https://twitter.com/${tw.replace(/^@/, '')}` });
  if (typeof li === 'string' && li) pairs.push({ label: 'LinkedIn', url: li.startsWith('http') ? li : `https://${li}` });
  if (typeof yt === 'string' && yt) pairs.push({ label: 'YouTube', url: yt.startsWith('http') ? yt : `https://youtube.com/${yt}` });
  if (typeof web === 'string' && web) pairs.push({ label: 'Website', url: web.startsWith('http') ? web : `https://${web}` });
  return pairs;
}

export default function InstructorProfile() {
  const { id } = useParams<{ id: string }>();
  const hasUrl = Boolean(getDirectusUrl());

  const insQ = useQuery({
    queryKey: ['instructor', id],
    enabled: hasUrl && Boolean(id),
    queryFn: () => fetchInstructorById(id!),
  });

  const coursesQ = useQuery({
    queryKey: ['courses', 'by-instructor', id],
    enabled: hasUrl && Boolean(id),
    queryFn: () => fetchCoursesByInstructor(id!),
  });

  const ins = insQ.data as UnknownRecord | undefined;
  const name = ins ? instructorName(ins) : '';
  const avatarUrl = ins?.avatar ? directusAssetUrl(ins.avatar as string | { id: string }) : undefined;
  const links = ins ? socialLinks(ins) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {!hasUrl ? <p className="text-sm text-amber-800">Set VITE_DIRECTUS_URL.</p> : null}
      {insQ.isError ? <p className="text-sm text-rose-600">Instructor not found.</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-36 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600" aria-hidden />
        <div className="relative -mt-16 flex flex-col gap-4 px-6 pb-8 sm:flex-row sm:items-end">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-md">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1 pb-1 pt-2 sm:pt-0">
            <h1 className="text-2xl font-bold text-slate-900">{name || 'Instructor'}</h1>
            {ins?.headline ? <p className="mt-1 text-slate-600">{String(ins.headline)}</p> : null}
            <dl className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <div>
                <dt className="text-xs uppercase text-slate-400">Students</dt>
                <dd className="font-semibold text-slate-900">
                  {ins?.total_students != null ? Number(ins.total_students) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Courses</dt>
                <dd className="font-semibold text-slate-900">
                  {ins?.total_courses != null ? Number(ins.total_courses) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Rating</dt>
                <dd className="font-semibold text-slate-900">{ins?.average_rating != null ? Number(ins.average_rating).toFixed(1) : '—'}</dd>
              </div>
            </dl>
            {links.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                    >
                      {l.label}
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        {ins?.bio ? (
          <div className="border-t border-slate-100 px-6 py-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">About</h2>
            <p className="mt-2 whitespace-pre-wrap text-slate-700">{String(ins.bio)}</p>
          </div>
        ) : null}
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Courses by this instructor</h2>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {(coursesQ.data ?? []).map((raw: UnknownRecord) => (
            <CourseCard key={String(raw.id)} course={mapToCourse(raw)} variant="catalog" />
          ))}
        </div>
        {!coursesQ.data?.length && coursesQ.isSuccess ? (
          <p className="mt-4 text-sm text-slate-500">No published courses yet.</p>
        ) : null}
      </section>

      <p className="mt-8 text-center text-sm text-slate-500">
        <Link to="/instructors" className="font-medium text-indigo-600 hover:text-indigo-800">
          ← All instructors
        </Link>
      </p>
    </div>
  );
}
