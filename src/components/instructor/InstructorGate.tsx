import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { hasDirectusEnv } from '@/lib/directus';
import { EmptyState } from '@/components/ui-custom/EmptyState';

function roleName(user: ReturnType<typeof useCurrentUser>['data']): string | undefined {
  const r = user?.role;
  if (r && typeof r === 'object' && 'name' in r) return (r as { name?: string }).name ?? undefined;
  return undefined;
}

export function InstructorGate({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();

  if (!hasDirectusEnv()) {
    return <p className="p-6 text-sm text-amber-800">Set VITE_DIRECTUS_URL.</p>;
  }
  if (isLoading) return <p className="p-6 text-sm text-slate-600">Loading…</p>;
  if (!user) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState
          icon={ShieldAlert}
          title="Sign in"
          description="Instructor tools require a signed-in Directus user."
          primaryLabel="Log in"
          onPrimary={() => {
            window.location.href = '/login';
          }}
        />
      </div>
    );
  }
  if (roleName(user)?.toLowerCase() !== 'instructor') {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState
          icon={ShieldAlert}
          title="Instructor access"
          description="These pages are for accounts with the Instructor role in Directus."
          primaryLabel="Back to home"
          onPrimary={() => {
            window.location.href = '/';
          }}
        />
        <p className="mt-4 text-center text-sm text-slate-600">
          <Link to="/" className="text-indigo-600 hover:underline">
            Home
          </Link>
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
