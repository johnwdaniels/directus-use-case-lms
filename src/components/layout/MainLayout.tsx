import { Outlet } from 'react-router-dom';
import { SiteHeader } from '@/components/layout/SiteHeader';

export function MainLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
