import { Routes, Route } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ComponentShowcase } from '@/dev/ComponentShowcase';

function Home() {
  return (
    <div className="px-4 py-8 text-slate-900 sm:px-8">
      <ComponentShowcase />
    </div>
  );
}

function NotFound() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return (
    <div className="flex flex-1 items-center justify-center p-6">
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
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/courses"
          element={
            <PlaceholderPage
              title="Courses"
              description="The public catalog and course detail pages are built in a later phase. This link is here so the header matches the planned information architecture."
            />
          }
        />
        <Route
          path="/categories"
          element={
            <PlaceholderPage
              title="Categories"
              description="Category landing pages will list courses by taxonomy. Not implemented in the component-only phase."
            />
          }
        />
        <Route
          path="/my/learning"
          element={
            <PlaceholderPage
              title="My learning"
              description="The authenticated learner dashboard (in progress, resume, certificates) ships with the learner routes phase."
            />
          }
        />
        <Route
          path="/login"
          element={
            <PlaceholderPage
              title="Log in"
              description="Authentication (Directus cookie session, Zustand shell, forms) is wired in the auth phase. Use this header link as the future entry point."
            />
          }
        />
        <Route
          path="/signup"
          element={
            <PlaceholderPage
              title="Sign up"
              description="Registration will create or link a Directus user for the Learner role. Placeholder until the auth flow is implemented."
            />
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
