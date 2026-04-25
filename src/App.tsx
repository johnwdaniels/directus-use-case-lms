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
import Login from '@/pages/Login';
import MyLearning from '@/pages/learner/MyLearning';
import MyCompleted from '@/pages/learner/MyCompleted';
import MyCertificates from '@/pages/learner/MyCertificates';
import CertificateView from '@/pages/learner/CertificateView';
import MyBadges from '@/pages/learner/MyBadges';
import MyProfile from '@/pages/learner/MyProfile';
import CoursePlayer from '@/pages/learner/CoursePlayer';
import QuizRunner from '@/pages/learner/QuizRunner';
import QuizResult from '@/pages/learner/QuizResult';
import AssignmentSubmission from '@/pages/learner/AssignmentSubmission';
import AssignmentList from '@/pages/learner/AssignmentList';
import InstructorDashboard from '@/pages/instructor/InstructorDashboard';
import MyCourses from '@/pages/instructor/MyCourses';
import CourseEditor from '@/pages/instructor/CourseEditor';
import CourseStudents from '@/pages/instructor/CourseStudents';
import GradingQueue from '@/pages/instructor/GradingQueue';
import CourseAnalytics from '@/pages/instructor/CourseAnalytics';
import QuizEditPage from '@/pages/instructor/QuizEditPage';

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
      <Route path="/quiz/:attemptId" element={<QuizRunner />} />
      <Route path="/quiz/:attemptId/results" element={<QuizResult />} />
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
        <Route path="/learn/:courseSlug/:lessonId" element={<CoursePlayer />} />
        <Route path="/learn/:courseSlug" element={<CoursePlayer />} />
        <Route path="/my/learning" element={<MyLearning />} />
        <Route path="/my/completed" element={<MyCompleted />} />
        <Route path="/my/certificates" element={<MyCertificates />} />
        <Route path="/my/certificates/:id" element={<CertificateView />} />
        <Route path="/my/badges" element={<MyBadges />} />
        <Route path="/my/profile" element={<MyProfile />} />
        <Route path="/my/assignments" element={<AssignmentList />} />
        <Route path="/assignment/:assignmentId" element={<AssignmentSubmission />} />
        <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
        <Route path="/instructor/courses" element={<MyCourses />} />
        <Route path="/instructor/courses/:id/edit" element={<CourseEditor />} />
        <Route path="/instructor/courses/:id/quizzes/:quizId/edit" element={<QuizEditPage />} />
        <Route path="/instructor/courses/:id/students" element={<CourseStudents />} />
        <Route path="/instructor/courses/:id/grading" element={<GradingQueue />} />
        <Route path="/instructor/courses/:id/analytics" element={<CourseAnalytics />} />
        <Route path="/login" element={<Login />} />
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
