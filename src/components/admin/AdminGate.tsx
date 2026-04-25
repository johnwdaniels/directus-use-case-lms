import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { hasDirectusEnv } from '@/lib/directus';
import { EmptyState } from '@/components/ui-custom/EmptyState';

function roleName(user: ReturnType<typeof useCurrentUser>['data']): string {
  const r = user?.role;
  if (r && typeof r === 'object' && 'name' in r) return String((r as { name?: string }).name ?? '');
  return '';
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  const role = roleName(user).toLowerCase();
  const isAdmin = role === 'administrator' || role === 'admin';

  if (!hasDirectusEnv()) return <p className="p-6 text-sm text-amber-800">Set VITE_DIRECTUS_URL.</p>;
  if (isLoading) return <p className="p-6 text-sm text-slate-600">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState
          icon={ShieldAlert}
          title="Sign in"
          description="Admin tools require a signed-in Directus user."
          primaryLabel="Log in"
          onPrimary={() => {
            window.location.href = '/login';
          }}
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState
          icon={ShieldAlert}
          title="Admin access"
          description="These pages require the Administrator role in Directus."
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
