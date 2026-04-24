import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { directus, hasDirectusEnv } from '@/lib/directus';
import { useCurrentUser } from '@/hooks/useCurrentUser';

function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/my/learning';
  return raw;
}

export default function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const then = useMemo(() => safeRedirect(params.get('then')), [params]);
  const { data: user, isLoading } = useCurrentUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) navigate(then, { replace: true });
  }, [navigate, then, user]);

  const login = useMutation({
    mutationFn: async () => {
      await directus.login(email.trim(), password, { mode: 'cookie' });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate(then, { replace: true });
    },
  });

  if (!hasDirectusEnv()) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Set <code>VITE_DIRECTUS_URL</code> to enable login.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
            <LogIn className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Log in</h1>
            <p className="text-sm text-slate-600">Use your LMS account credentials.</p>
          </div>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <div>
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {login.isError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Login failed. Check your email and password.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={login.isPending || isLoading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {login.isPending ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Need an account?{' '}
          <Link to="/signup" className="font-medium text-indigo-700 hover:text-indigo-900">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
