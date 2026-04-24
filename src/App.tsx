import { Routes, Route } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { EmptyState } from '@/components/ui-custom/EmptyState';

function Home() {
  return (
    <div className="min-h-dvh bg-slate-50 p-8 text-slate-900">
      <h1 className="text-2xl font-semibold tracking-tight">LMS frontend</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
        Reusable UI lives under{' '}
        <code className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">src/components</code>. Course pages and
        the player are wired in later phases.
      </p>
      <p className="mt-6 text-sm text-slate-500">
        If you saw a browser “page can’t be found” error for this URL, the dev server was probably not running. From
        this folder run:{' '}
        <code className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">npm run dev</code>
      </p>
    </div>
  );
}

function NotFound() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <EmptyState
          icon={FileQuestion}
          title="Page not found"
          description={`No route matches ${path || 'this URL'}. Use the address bar to go back to / or reload.`}
          primaryLabel="Reload"
          onPrimary={() => window.location.reload()}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
