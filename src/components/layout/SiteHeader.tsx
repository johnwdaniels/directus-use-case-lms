import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Menu, Search, X } from 'lucide-react';
import { useSearchDialog } from '@/context/search-dialog';
import { cn } from '@/lib/cn';
import { directus } from '@/lib/directus';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  );

const navItems = [
  { to: '/courses', label: 'Courses' },
  { to: '/categories', label: 'Categories' },
  { to: '/instructors', label: 'Instructors' },
  { to: '/my/learning', label: 'My learning' },
  { to: '/my/certificates', label: 'Certificates' },
  { to: '/my/badges', label: 'Badges' },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openSearch } = useSearchDialog();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();

  const userName =
    `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.email || 'Account';

  async function logout() {
    await directus.logout().catch(() => {});
    await qc.invalidateQueries({ queryKey: ['me'] });
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-slate-900" onClick={() => setMenuOpen(false)}>
          <GraduationCap className="h-8 w-8 text-indigo-600" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">LMS</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {navItems.map(({ to, label }) => (
            <NavLink key={to} to={to} className={navClass}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 md:inline-flex"
            aria-label="Search (⌘K)"
            onClick={() => openSearch()}
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>
          {user ? (
            <>
              <Link
                to="/my/profile"
                className="hidden max-w-36 truncate rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-block"
                onClick={() => setMenuOpen(false)}
              >
                {userName}
              </Link>
              <button
                type="button"
                className="hidden rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 sm:inline-block"
                onClick={() => void logout()}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-block"
                onClick={() => setMenuOpen(false)}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="hidden rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 sm:inline-block"
                onClick={() => setMenuOpen(false)}
              >
                Sign up
              </Link>
            </>
          )}
          <button
            type="button"
            className="inline-flex rounded-md border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id="mobile-nav" className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink key={to} to={to} className={navClass} onClick={() => setMenuOpen(false)}>
                {label}
              </NavLink>
            ))}
            <hr className="my-2 border-slate-200" />
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setMenuOpen(false);
                openSearch();
              }}
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              Search
            </button>
            {user ? (
              <>
                <Link
                  to="/my/profile"
                  className="rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  {userName}
                </Link>
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white"
                  onClick={() => void logout()}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
