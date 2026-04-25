import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { fetchCourseAnalytics } from '@/api/instructor';
import { hasDirectusEnv } from '@/lib/directus';
import { InstructorGate } from '@/components/instructor/InstructorGate';
import type { UnknownRecord } from '@/api/public';

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

export default function CourseAnalytics() {
  const { id: courseId } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ['course-analytics', courseId],
    enabled: hasDirectusEnv() && Boolean(courseId),
    queryFn: () => fetchCourseAnalytics(courseId!),
  });

  const enrollSeries = useMemo(() => {
    const rows = (q.data?.enrollments90 ?? []) as UnknownRecord[];
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const d = r.date_created ? String(r.date_created).slice(0, 10) : '';
      if (!d) continue;
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }, [q.data?.enrollments90]);

  const completionDonut = useMemo(() => {
    const all = (q.data?.enrollments ?? []) as UnknownRecord[];
    let completed = 0;
    let active = 0;
    let dropped = 0;
    for (const e of all) {
      const s = String(e.status ?? '').toLowerCase();
      if (s === 'completed') completed += 1;
      else if (s === 'dropped') dropped += 1;
      else active += 1;
    }
    return [
      { name: 'Completed', value: completed },
      { name: 'Active', value: active },
      { name: 'Dropped', value: dropped },
    ].filter((x) => x.value > 0);
  }, [q.data?.enrollments]);

  const lessonBars = useMemo(() => {
    const lp = (q.data?.lessonProgress ?? []) as UnknownRecord[];
    const byLesson = new Map<string, { title: string; done: number; total: number }>();
    for (const row of lp) {
      const le = row.lesson as UnknownRecord | undefined;
      const lid = typeof row.lesson === 'object' && le?.id ? String(le.id) : String(row.lesson ?? '');
      const title = le?.title ? String(le.title) : lid;
      const cur = byLesson.get(lid) ?? { title, done: 0, total: 0 };
      cur.total += 1;
      if (String(row.status ?? '') === 'completed') cur.done += 1;
      byLesson.set(lid, cur);
    }
    return [...byLesson.values()].map((v) => ({
      name: v.title.length > 24 ? `${v.title.slice(0, 24)}…` : v.title,
      rate: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));
  }, [q.data?.lessonProgress]);

  const ratingDist = useMemo(() => {
    const rev = (q.data?.reviews ?? []) as UnknownRecord[];
    const bins = [5, 4, 3, 2, 1].map((star) => ({ star: `${star}★`, count: 0 }));
    for (const r of rev) {
      const rating = Math.min(5, Math.max(1, Math.round(Number(r.rating ?? 0))));
      bins[5 - rating].count += 1;
    }
    return bins;
  }, [q.data?.reviews]);

  const courseRow = q.data?.courseRow as UnknownRecord | undefined;
  const quizScores = q.data?.quizScores ?? [];

  const avgProgress = useMemo(() => {
    const all = (q.data?.enrollments ?? []) as UnknownRecord[];
    if (!all.length) return 0;
    let s = 0;
    for (const e of all) s += Number(e.progress_pct ?? 0);
    return Math.round(s / all.length);
  }, [q.data?.enrollments]);

  return (
    <InstructorGate>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Course analytics</h1>
          <Link to={`/instructor/courses/${encodeURIComponent(courseId ?? '')}/edit`} className="text-sm font-medium text-indigo-600 hover:underline">
            ← Editor
          </Link>
        </div>

        {q.isLoading ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : null}

        {q.data ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Total students</p>
                <p className="text-2xl font-bold">{String(courseRow?.enrollment_count ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Completions</p>
                <p className="text-2xl font-bold">{String(courseRow?.completion_count ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Avg progress</p>
                <p className="text-2xl font-bold">{avgProgress}%</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Avg rating</p>
                <p className="text-2xl font-bold">{courseRow?.average_rating != null ? Number(courseRow.average_rating).toFixed(2) : '—'}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Enrollments (90 days)</h2>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={enrollSeries}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Completion mix</h2>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={completionDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {completionDonut.map((_, i) => (
                          <Cell key={String(i)} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                <h2 className="text-sm font-semibold text-slate-900">Lesson completion rate</h2>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lessonBars} layout="vertical" margin={{ left: 80 }}>
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="rate" fill="#0ea5e9" name="Completion %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Avg quiz score</h2>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quizScores.map((z) => ({ name: z.title.length > 16 ? `${z.title.slice(0, 16)}…` : z.title, score: z.avg }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={70} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#6366f1" name="Avg %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Rating distribution</h2>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingDist}>
                      <XAxis dataKey="star" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </InstructorGate>
  );
}
