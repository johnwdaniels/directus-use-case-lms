import { Routes, Route } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ComponentShowcase } from '@/dev/ComponentShowcase';
import Home from '@/pages/Home';
import CoursesList from '@/pages/CoursesList';
import CourseDetail from '@/pages/CourseDetail';
import CategoriesList from '@/pages/CategoriesList';
import CategoryDetail from '@/pages/CategoryDetail';
import InstructorsList from '@/pages/InstructorsList';
import InstructorProfile from '@/pages/InstructorProfile';
import VerifyCertificate from '@/pages/VerifyCertificate';

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
        <Route path="/courses" element={<CoursesList />} />
        <Route path="/courses/:slug" element={<CourseDetail />} />
        <Route path="/categories" element={<CategoriesList />} />
        <Route path="/categories/:slug" element={<CategoryDetail />} />
        <Route path="/instructors" element={<InstructorsList />} />
        <Route path="/instructors/:id" element={<InstructorProfile />} />
        <Route path="/verify/:code" element={<VerifyCertificate />} />
        <Route path="/dev" element={<ComponentShowcase />} />
        <Route
          path="/learn/:courseSlug"
          element={
            <PlaceholderPage
              title="Course player"
              description="The authenticated learner experience opens here after enrollment. This route exists so enrollment redirects land safely."
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
