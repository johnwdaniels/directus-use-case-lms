import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { SearchDialogContext } from '@/context/search-dialog';

export function MainLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const searchCtx = useMemo(() => ({ openSearch }), [openSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SearchDialogContext.Provider value={searchCtx}>
      <div className="flex min-h-dvh flex-col bg-slate-50">
        <SiteHeader />
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </SearchDialogContext.Provider>
  );
}
