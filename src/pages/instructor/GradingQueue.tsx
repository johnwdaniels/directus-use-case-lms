import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchEssayQuizResponsesForGrading,
  fetchSubmissionsForGrading,
  saveQuizResponseGrade,
  saveSubmissionGrade,
} from '@/api/instructor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { hasDirectusEnv } from '@/lib/directus';
import { InstructorGate } from '@/components/instructor/InstructorGate';
import { RichTextEditor } from '@/components/content/RichTextEditor';
import type { UnknownRecord } from '@/api/public';

export default function GradingQueue() {
  const { id: courseId } = useParams<{ id: string }>();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [mainTab, setMainTab] = useState<'assignments' | 'essays'>('assignments');
  const [subTab, setSubTab] = useState<'submitted' | 'graded'>('submitted');

  const subQ = useQuery({
    queryKey: ['grading-submissions', courseId, subTab],
    enabled: hasDirectusEnv() && Boolean(courseId) && mainTab === 'assignments',
    queryFn: () => fetchSubmissionsForGrading(courseId!, subTab),
  });

  const essayQ = useQuery({
    queryKey: ['grading-essays', courseId],
    enabled: hasDirectusEnv() && Boolean(courseId) && mainTab === 'essays',
    queryFn: () => fetchEssayQuizResponsesForGrading(courseId!),
  });

  const [drawerSub, setDrawerSub] = useState<UnknownRecord | null>(null);
  const [drawerEssay, setDrawerEssay] = useState<UnknownRecord | null>(null);
  const [grade, setGrade] = useState<number | ''>('');
  const [feedback, setFeedback] = useState('');
  const [subStatus, setSubStatus] = useState('graded');
  const [essayCorrect, setEssayCorrect] = useState<boolean | null>(null);
  const [essayPoints, setEssayPoints] = useState<number | ''>('');

  const saveSub = useMutation({
    mutationFn: async () => {
      if (!drawerSub || !user?.id) return;
      await saveSubmissionGrade(String(drawerSub.id), {
        grade: grade === '' ? null : Number(grade),
        grader_feedback: feedback,
        status: subStatus,
        graded_by: user.id,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['grading-submissions'] });
      setDrawerSub(null);
      setGrade('');
      setFeedback('');
    },
  });

  const saveEssay = useMutation({
    mutationFn: async () => {
      if (!drawerEssay || !user?.id) return;
      await saveQuizResponseGrade(String(drawerEssay.id), {
        is_correct: essayCorrect,
        points_earned: essayPoints === '' ? null : Number(essayPoints),
        grader_feedback: feedback,
        graded_by: user.id,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['grading-essays'] });
      setDrawerEssay(null);
      setFeedback('');
      setEssayPoints('');
    },
  });

  return (
    <InstructorGate>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Grading queue</h1>
          <Link to={`/instructor/courses/${encodeURIComponent(courseId ?? '')}/edit`} className="text-sm font-medium text-indigo-600 hover:underline">
            ← Editor
          </Link>
        </div>

        <div className="mt-6 flex gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${mainTab === 'assignments' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
            onClick={() => setMainTab('assignments')}
          >
            Assignments
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${mainTab === 'essays' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
            onClick={() => setMainTab('essays')}
          >
            Essay responses
          </button>
        </div>

        {mainTab === 'assignments' ? (
          <>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className={`rounded-md px-3 py-1 text-sm ${subTab === 'submitted' ? 'bg-indigo-100 text-indigo-900' : 'text-slate-600'}`}
                onClick={() => setSubTab('submitted')}
              >
                Submitted
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1 text-sm ${subTab === 'graded' ? 'bg-indigo-100 text-indigo-900' : 'text-slate-600'}`}
                onClick={() => setSubTab('graded')}
              >
                Graded
              </button>
            </div>
            <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {(subQ.data ?? []).map((s) => {
                const u = s.user as UnknownRecord | undefined;
                const a = s.assignment as UnknownRecord | undefined;
                const name = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim();
                return (
                  <li key={String(s.id)}>
                    <button type="button" className="flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-slate-50" onClick={() => setDrawerSub(s)}>
                      <span className="font-medium text-slate-900">{name}</span>
                      <span className="text-slate-600">{String(a?.title ?? '')}</span>
                      <span className="text-xs text-slate-400">
                        {s.submitted_at ? String(s.submitted_at) : ''}
                        {s.is_late ? <span className="ml-2 rounded bg-amber-100 px-1.5 text-amber-900">Late</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {(essayQ.data ?? []).map((r) => {
              const att = r.attempt as UnknownRecord | undefined;
              const usr = att?.user as UnknownRecord | undefined;
              const name = `${usr?.first_name ?? ''} ${usr?.last_name ?? ''}`.trim();
              return (
                <li key={String(r.id)}>
                  <button type="button" className="flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-slate-50" onClick={() => setDrawerEssay(r)}>
                    <span className="font-medium text-slate-900">{name}</span>
                    <span className="line-clamp-2 text-slate-600">{String(r.text_answer ?? '').replace(/<[^>]+>/g, ' ')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {drawerSub ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold">Grade submission</h2>
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{String(drawerSub.text_response ?? '')}</p>
              <p className="mt-2 text-sm text-indigo-700">{String(drawerSub.url_response ?? '')}</p>
              <label className="mt-4 block text-sm">
                Grade
                <input type="number" className="mt-1 w-full rounded border border-slate-200 px-3 py-2" value={grade} onChange={(e) => setGrade(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
              <label className="mt-3 block text-sm">
                Status
                <select className="mt-1 w-full rounded border border-slate-200 px-3 py-2" value={subStatus} onChange={(e) => setSubStatus(e.target.value)}>
                  <option value="graded">Graded</option>
                  <option value="returned_for_revision">Returned for revision</option>
                </select>
              </label>
              <div className="mt-3">
                <span className="text-sm font-medium">Feedback</span>
                <RichTextEditor value={feedback} onChange={setFeedback} />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setDrawerSub(null)}>
                  Cancel
                </button>
                <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" onClick={() => saveSub.mutate()}>
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {drawerEssay ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold">Grade essay</h2>
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{String(drawerEssay.text_answer ?? '')}</p>
              <div className="mt-4 flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="ok" checked={essayCorrect === true} onChange={() => setEssayCorrect(true)} />
                  Accept
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="ok" checked={essayCorrect === false} onChange={() => setEssayCorrect(false)} />
                  Reject
                </label>
              </div>
              <label className="mt-3 block text-sm">
                Points
                <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={essayPoints} onChange={(e) => setEssayPoints(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
              <div className="mt-3">
                <span className="text-sm font-medium">Feedback</span>
                <RichTextEditor value={feedback} onChange={setFeedback} />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setDrawerEssay(null)}>
                  Cancel
                </button>
                <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" onClick={() => saveEssay.mutate()}>
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </InstructorGate>
  );
}
