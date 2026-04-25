import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, BadgeCheck, DollarSign, Users } from 'lucide-react';
import { fetchAdminDashboardData } from '@/api/admin';
import { AdminGate } from '@/components/admin/AdminGate';
import type { UnknownRecord } from '@/api/public';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const q = useQuery({ queryKey: ['admin-dashboard'], queryFn: fetchAdminDashboardData });

  return (
    <AdminGate>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Platform-wide overview with recent cross-platform activity.</p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700" to="/admin/users">Users</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700" to="/admin/categories">Categories</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700" to="/admin/badges">Badges</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700" to="/admin/certificate-templates">Certificate templates</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700" to="/admin/reviews">Reviews</Link>
          <Link className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700" to="/admin/announcements">Announcements</Link>
        </div>

        {q.isLoading ? <p className="mt-8 text-sm text-slate-500">Loading…</p> : null}
        {q.isError ? <p className="mt-8 text-sm text-rose-600">Could not load admin dashboard.</p> : null}

        {q.data ? (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total users (all roles)" value={(q.data.usersByRole as UnknownRecord[]).reduce((n, r) => n + Number(r.count ?? 0), 0)} />
              <StatCard label="Total courses (all statuses)" value={(q.data.coursesByStatus as UnknownRecord[]).reduce((n, r) => n + Number(r.count ?? 0), 0)} />
              <StatCard label="Total enrollments" value={q.data.totalEnrollments} />
              <StatCard label="Total certificates" value={q.data.totalCertificates} />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-indigo-600" /><h2 className="font-semibold text-slate-900">Users by role</h2></div>
                <ul className="space-y-1 text-sm">
                  {(q.data.usersByRole as UnknownRecord[]).map((row) => (
                    <li key={String((row.role as UnknownRecord | undefined)?.name ?? 'none')} className="flex justify-between">
                      <span>{String((row.role as UnknownRecord | undefined)?.name ?? 'No role')}</span>
                      <strong>{String(row.count ?? 0)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-600" /><h2 className="font-semibold text-slate-900">Courses by status</h2></div>
                <ul className="space-y-1 text-sm">
                  {(q.data.coursesByStatus as UnknownRecord[]).map((row) => (
                    <li key={String(row.status ?? 'none')} className="flex justify-between">
                      <span>{String(row.status ?? 'Unknown')}</span>
                      <strong>{String(row.count ?? 0)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-indigo-600" /><h2 className="font-semibold text-slate-900">Certificates issued</h2></div>
                <p className="text-2xl font-bold">{q.data.totalCertificates}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2"><DollarSign className="h-4 w-4 text-indigo-600" /><h2 className="font-semibold text-slate-900">Revenue (placeholder)</h2></div>
                <p className="text-2xl font-bold">${q.data.totalRevenuePlaceholder.toLocaleString()}</p>
              </div>
            </div>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
              <ul className="mt-3 divide-y rounded-xl border border-slate-200 bg-white">
                {q.data.activity.map((item) => (
                  <li key={item.id} className="px-4 py-3 text-sm">
                    <p className="font-medium text-slate-900">{item.type === 'enrollment' ? 'New enrollment' : item.type === 'publish' ? 'Course published' : 'Certificate issued'}</p>
                    <p className="text-slate-600">{new Date(item.at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </AdminGate>
  );
}
