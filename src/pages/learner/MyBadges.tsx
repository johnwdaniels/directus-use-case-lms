import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Medal } from 'lucide-react';
import { fetchMyBadges } from '@/api/learner';
import { directusAssetUrl } from '@/lib/assets';
import { hasDirectusEnv } from '@/lib/directus';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import type { UnknownRecord } from '@/api/public';

export default function MyBadges() {
  const { data: user } = useCurrentUser();
  const enabled = hasDirectusEnv() && Boolean(user?.id);

  const q = useQuery({
    queryKey: ['user_badges', user?.id],
    enabled,
    queryFn: () => fetchMyBadges(user!.id),
  });

  if (!hasDirectusEnv()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-sm text-amber-800">Set VITE_DIRECTUS_URL to load badges.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EmptyState
          icon={Medal}
          title="Sign in"
          description="Log in to see badges you have earned."
          primaryLabel="Log in"
          onPrimary={() => {
            window.location.href = '/login';
          }}
        />
      </div>
    );
  }

  const rows = (q.data ?? []) as UnknownRecord[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">My badges</h1>
      <p className="mt-1 text-sm text-slate-600">Recognition for milestones and achievements.</p>

      {q.isLoading ? <p className="mt-8 text-sm text-slate-500">Loading…</p> : null}

      {!q.isLoading && !rows.length ? (
        <div className="mt-10">
          <EmptyState
            icon={Medal}
            title="No badges yet"
            description="Complete courses, pass quizzes, and stay active to earn badges. Your awards will show up here."
            primaryLabel="Explore courses"
            onPrimary={() => {
              window.location.href = '/courses';
            }}
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const b = row.badge as UnknownRecord | undefined;
            const icon = directusAssetUrl(b?.icon as string | { id: string } | null | undefined);
            const when = row.awarded_at ? format(new Date(String(row.awarded_at)), 'PP') : '—';
            const ctx = row.awarded_context != null ? String(row.awarded_context) : '';
            return (
              <li
                key={String(row.id)}
                className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-2xl"
                  style={{ backgroundColor: b?.color ? String(b.color) + '22' : undefined }}
                >
                  {icon ? <img src={icon} alt="" className="h-full w-full object-cover" loading="lazy" /> : '🏅'}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900">{String(b?.name ?? 'Badge')}</h2>
                  <p className="text-xs text-slate-500">{when}</p>
                  {ctx ? <p className="mt-1 text-sm text-slate-600">{ctx}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
