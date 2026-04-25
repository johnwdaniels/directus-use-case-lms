import { useQuery } from '@tanstack/react-query';
import { Medal } from 'lucide-react';
import { fetchMyBadges } from '@/api/learner';
import { hasDirectusEnv } from '@/lib/directus';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import { BadgeCard } from '@/components/badges/BadgeCard';
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
            return (
              <li key={String(row.id)}>
                <BadgeCard award={row} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
