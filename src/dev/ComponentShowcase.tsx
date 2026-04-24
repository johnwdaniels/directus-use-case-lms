import { useState } from 'react';
import { CourseCard } from '@/components/courses/CourseCard';
import { CurriculumOutline } from '@/components/courses/CurriculumOutline';
import { Announcement } from '@/components/courses/Announcement';
import { RichText } from '@/components/content/RichText';
import { ProgressBar } from '@/components/courses/ProgressBar';
import { StarRating } from '@/components/ui-custom/StarRating';
import type { Course, CourseWithCurriculum } from '@/types/lms';

const sampleCourse: Course = {
  id: 'demo-course',
  title: 'Intro to Directus for LMS',
  slug: 'intro-directus-lms',
  subtitle: 'Schema, flows, permissions, and a learner-ready API',
  description:
    'Hover this card in the catalog variant to see the description preview. Covers everything you need to ship a course platform on top of Directus.',
  duration_minutes: 185,
  difficulty: 'Beginner',
  price: 49,
  currency: 'USD',
  is_free: false,
  average_rating: 4.35,
  rating_count: 128,
  instructor: {
    first_name: 'Alex',
    last_name: 'Rivera',
  },
  category: { name: 'Backend', slug: 'backend' },
};

const continueCourse: Course = {
  ...sampleCourse,
  id: 'demo-continue',
  slug: 'intro-directus-lms',
  progress_pct: 62,
  last_lesson_title: 'Flows: event hooks vs schedules',
  time_remaining_minutes: 72,
};

const curriculumCourse: CourseWithCurriculum = {
  ...sampleCourse,
  id: 'demo-curriculum',
  modules: [
    {
      id: 'mod-1',
      title: 'Getting started',
      sort_order: 1,
      lessons: [
        {
          id: 'les-1',
          title: 'Welcome (preview)',
          lesson_type: 'video',
          duration_minutes: 8,
          is_preview: true,
          sort_order: 1,
        },
        {
          id: 'les-2',
          title: 'Install and environment',
          lesson_type: 'text',
          duration_minutes: 12,
          is_preview: false,
          sort_order: 2,
        },
      ],
    },
    {
      id: 'mod-2',
      title: 'Assessments',
      sort_order: 2,
      lessons: [
        {
          id: 'les-3',
          title: 'Permissions quiz',
          lesson_type: 'quiz',
          duration_minutes: 15,
          is_preview: false,
          sort_order: 1,
        },
        {
          id: 'les-4',
          title: 'Turn in schema diagram',
          lesson_type: 'assignment',
          duration_minutes: 25,
          is_preview: false,
          sort_order: 2,
        },
      ],
    },
  ],
};

export function ComponentShowcase() {
  const [inputStars, setInputStars] = useState(4);

  return (
    <div className="mx-auto max-w-6xl space-y-12 pb-16 pt-4">
      <header className="space-y-2 border-b border-slate-200 pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">LMS frontend</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Phase: reusable components only — no real catalog or player routes yet. Below is mock data so you can
          review layout and states in the browser.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">CourseCard</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">catalog</p>
            <CourseCard course={sampleCourse} variant="catalog" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">continue</p>
            <CourseCard course={continueCourse} variant="continue" />
          </div>
          <div className="space-y-2 md:col-span-2 lg:col-span-1">
            <p className="text-xs font-medium text-slate-500">compact</p>
            <CourseCard course={sampleCourse} variant="compact" />
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">CurriculumOutline</h2>
          <p className="text-xs text-slate-500">preview · not enrolled (locks on non-preview lessons)</p>
          <CurriculumOutline
            course={curriculumCourse}
            variant="preview"
            isEnrolled={false}
            onLessonClick={(id) => console.info('lesson click', id)}
          />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">CurriculumOutline</h2>
          <p className="text-xs text-slate-500">player · current lesson highlighted</p>
          <CurriculumOutline
            course={curriculumCourse}
            variant="player"
            currentLessonId="les-2"
            progress={{ 'les-1': 'completed', 'les-2': 'in_progress' }}
            onLessonClick={(id) => console.info('lesson click', id)}
          />
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">ProgressBar · StarRating</h2>
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <ProgressBar value={33} size="sm" showLabel />
            <ProgressBar value={66} size="md" showLabel />
            <ProgressBar value={90} size="lg" />
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs text-slate-500">display</p>
              <StarRating mode="display" value={4.25} count={56} />
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs text-slate-500">input</p>
              <StarRating mode="input" value={inputStars} onChange={setInputStars} />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">RichText · Announcement</h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <RichText
              content={`## Markdown works\n\n- **Bold** and *italic*\n- [Link](https://directus.io)\n\n> A blockquote.`}
            />
          </div>
          <Announcement
            pinned
            authorName="Jordan Lee"
            title="Office hours moved to Thursday"
            body={'Please join **15 minutes early** — we will cover the new enrollment flow.'}
            published_at={new Date(Date.now() - 1000 * 60 * 60 * 5)}
          />
        </div>
      </section>
    </div>
  );
}
