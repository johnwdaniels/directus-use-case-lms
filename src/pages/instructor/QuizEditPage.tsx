import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchQuizForEditor } from '@/api/instructor';
import { hasDirectusEnv } from '@/lib/directus';
import { InstructorGate } from '@/components/instructor/InstructorGate';
import { QuizEditor } from '@/components/instructor/QuizEditor';

export default function QuizEditPage() {
  const { id: courseId, quizId } = useParams<{ id: string; quizId: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['instructor-quiz', quizId],
    enabled: hasDirectusEnv() && Boolean(quizId),
    queryFn: () => fetchQuizForEditor(quizId!),
  });

  return (
    <InstructorGate>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link to={`/instructor/courses/${encodeURIComponent(courseId ?? '')}/edit`} className="text-sm font-medium text-indigo-600 hover:underline">
          ← Back to course
        </Link>
        {q.isLoading ? <p className="mt-6 text-sm text-slate-500">Loading quiz…</p> : null}
        {q.data ? (
          <div className="mt-6">
            <QuizEditor
              quiz={q.data}
              onSaved={() => {
                void qc.invalidateQueries({ queryKey: ['instructor-quiz', quizId] });
                void qc.invalidateQueries({ queryKey: ['instructor-course', courseId] });
              }}
            />
          </div>
        ) : null}
      </div>
    </InstructorGate>
  );
}
