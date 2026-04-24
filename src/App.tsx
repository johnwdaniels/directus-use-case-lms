import { Routes, Route } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import { ComponentShowcase } from '@/dev/ComponentShowcase';

function Home() {
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <ComponentShowcase />
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
