import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import {
  fetchAssignmentDetail,
  fetchEnrollmentByCourseId,
  removeSubmissionFileJunction,
  saveAssignmentSubmission,
  uploadSubmissionFiles,
} from '@/api/learner';
import type { UnknownRecord } from '@/api/public';
import { directusAssetUrl } from '@/lib/assets';
import { hasDirectusEnv } from '@/lib/directus';
import { RichText } from '@/components/content/RichText';
import { RichTextEditor } from '@/components/content/RichTextEditor';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type SubmissionFile = {
  id: string;
  junctionId?: string;
  label: string;
};

function str(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function relationId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id);
  return '';
}

function parseSubmissionTypes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [value];
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
}

function filesFromSubmission(submission: UnknownRecord | null): SubmissionFile[] {
  const rows = Array.isArray(submission?.files) ? (submission.files as UnknownRecord[]) : [];
  return rows
    .map<SubmissionFile | null>((row) => {
      const file = row.directus_files_id as UnknownRecord | string | undefined;
      const id = relationId(file);
      if (!id) return null;
      const label =
        typeof file === 'object'
          ? str(file.filename_download, str(file.title, 'Attachment'))
          : 'Attachment';
      return { id, junctionId: String(row.id), label };
    })
    .filter((file): file is SubmissionFile => file != null);
}

function isPastDue(value: unknown) {
  const due = value ? new Date(String(value)).getTime() : NaN;
  return Number.isFinite(due) && due < Date.now();
}

export default function AssignmentSubmission() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [rubricOpen, setRubricOpen] = useState(false);
  const [textResponse, setTextResponse] = useState('');
  const [urlResponse, setUrlResponse] = useState('');
  const [files, setFiles] = useState<SubmissionFile[]>([]);

  const detailQ = useQuery({
    queryKey: ['assignment-detail', assignmentId, user?.id],
    enabled: Boolean(assignmentId && user?.id && hasDirectusEnv()),
    queryFn: () => fetchAssignmentDetail(assignmentId!, user!.id),
  });

  const assignment = detailQ.data?.assignment;
  const submission = detailQ.data?.submission ?? null;
  const course = (assignment?.course as UnknownRecord | undefined) ?? {};
  const courseId = relationId(course);
  const courseSlug = str(course.slug);
  const submissionTypes = useMemo(() => parseSubmissionTypes(assignment?.submission_types), [assignment?.submission_types]);
  const enabledTypes = submissionTypes.length ? submissionTypes : ['text_entry'];
  const late = isPastDue(assignment?.due_date);
  const status = str(submission?.status, 'draft');
  const editable = !submission || status === 'draft' || status === 'returned_for_revision';
  const graded = status === 'graded';

  const enrollmentQ = useQuery({
    queryKey: ['assignment-enrollment', courseId, user?.id],
    enabled: Boolean(courseId && user?.id && hasDirectusEnv()),
    queryFn: () => fetchEnrollmentByCourseId(courseId, user!.id),
  });

  useEffect(() => {
    if (!submission) return;
    setTextResponse(str(submission.text_response));
    setUrlResponse(str(submission.url_response));
    setFiles(filesFromSubmission(submission));
  }, [submission]);

  const uploadMut = useMutation({
    mutationFn: (incoming: File[]) => uploadSubmissionFiles(incoming),
    onSuccess: (created) => {
      setFiles((prev) => [
        ...prev,
        ...created
          .map((row) => ({ id: String(row.id), label: str(row.filename_download, str(row.title, 'Attachment')) }))
          .filter((row) => row.id),
      ]);
    },
  });

  const removeFileMut = useMutation({
    mutationFn: (file: SubmissionFile) => (file.junctionId ? removeSubmissionFileJunction(file.junctionId) : Promise.resolve()),
    onSuccess: (_, file) => {
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      void qc.invalidateQueries({ queryKey: ['assignment-detail', assignmentId, user?.id] });
    },
  });

  const saveMut = useMutation({
    mutationFn: (nextStatus: 'draft' | 'submitted') =>
      saveAssignmentSubmission({
        submissionId: submission?.id ? String(submission.id) : null,
        assignmentId: assignmentId!,
        userId: user!.id,
        enrollmentId: enrollmentQ.data?.id ? String(enrollmentQ.data.id) : null,
        status: nextStatus,
        textResponse: enabledTypes.includes('text_entry') ? textResponse : null,
        urlResponse: enabledTypes.includes('url') ? urlResponse : null,
        fileIds: enabledTypes.includes('file_upload') ? files.map((f) => f.id) : [],
        isLate: late,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assignment-detail', assignmentId, user?.id] });
      void qc.invalidateQueries({ queryKey: ['my-assignments', user?.id] });
    },
  });

  if (!hasDirectusEnv()) {
    return <p className="p-6 text-sm text-amber-800">Set VITE_DIRECTUS_URL.</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Link to="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          Log in to submit this assignment
        </Link>
      </div>
    );
  }

  if (detailQ.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-600">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading assignment…
      </div>
    );
  }

  if (!assignment) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-rose-700">Assignment not found.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-600">{str(course.title, 'Course')}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{str(assignment.title, 'Assignment')}</h1>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p>Due: {assignment.due_date ? new Date(String(assignment.due_date)).toLocaleString() : 'No due date'}</p>
            <p>Points: {num(assignment.max_points, 100)}</p>
            <p>Passing score: {num(assignment.passing_score, 70)}</p>
          </div>
        </div>
        {late ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This assignment is past due. Late policies may apply.
          </div>
        ) : null}
        {submission ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Current submission: {status.replace(/_/g, ' ')}</p>
            {graded ? (
              <div className="mt-3 rounded-xl bg-emerald-50 p-4 text-emerald-900">
                <p className="flex items-center gap-2 text-lg font-bold">
                  <CheckCircle2 className="h-5 w-5" />
                  Grade: {submission.grade == null ? 'Not posted' : `${num(submission.grade)}/${num(assignment.max_points, 100)}`}
                </p>
                {submission.grader_feedback ? <RichText content={str(submission.grader_feedback)} /> : null}
              </div>
            ) : submission.grader_feedback ? (
              <div className="mt-3 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
                <p className="font-semibold">Feedback</p>
                <RichText content={str(submission.grader_feedback)} />
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Instructions</h2>
        <div className="mt-3">
          <RichText content={str(assignment.instructions, str(assignment.description, 'No instructions provided.'))} />
        </div>
        {assignment.rubric ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setRubricOpen((v) => !v)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {rubricOpen ? 'Hide rubric' : 'Show rubric'}
            </button>
            {rubricOpen ? (
              <div className="mt-3 rounded-xl bg-slate-50 p-4">
                <RichText content={str(assignment.rubric)} />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <form
        className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Your submission</h2>
            {!editable ? <p className="mt-1 text-sm text-slate-600">This submission is not editable in its current status.</p> : null}
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {enabledTypes.map((t) => t.replace(/_/g, ' ')).join(', ')}
          </span>
        </div>

        {enabledTypes.includes('file_upload') ? (
          <div>
            <label className="text-sm font-semibold text-slate-800">Files</label>
            <div className="mt-2 rounded-xl border border-dashed border-slate-300 p-4">
              <input
                type="file"
                multiple
                disabled={!editable || uploadMut.isPending}
                onChange={(e) => {
                  const incoming = Array.from(e.target.files ?? []);
                  if (incoming.length) uploadMut.mutate(incoming);
                  e.currentTarget.value = '';
                }}
                className="text-sm"
              />
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Upload className="h-4 w-4" />
                Files upload to Directus immediately, then attach when you save.
              </p>
            </div>
            {files.length ? (
              <ul className="mt-3 space-y-2">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <a href={directusAssetUrl(file.id) ?? '#'} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-indigo-600 hover:underline">
                      {file.label}
                    </a>
                    {editable ? (
                      <button
                        type="button"
                        disabled={removeFileMut.isPending}
                        onClick={() => removeFileMut.mutate(file)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-rose-600"
                        aria-label={`Remove ${file.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {enabledTypes.includes('text_entry') ? (
          <div>
            <label className="text-sm font-semibold text-slate-800">Text entry</label>
            <RichTextEditor
              value={textResponse}
              onChange={setTextResponse}
              disabled={!editable}
              placeholder="Write your submission"
              className="mt-2"
            />
          </div>
        ) : null}

        {enabledTypes.includes('url') ? (
          <div>
            <label className="text-sm font-semibold text-slate-800">URL</label>
            <input
              type="url"
              value={urlResponse}
              disabled={!editable}
              onChange={(e) => setUrlResponse(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
              placeholder="https://example.com/project"
            />
          </div>
        ) : null}

        {saveMut.isError ? <p className="text-sm text-rose-600">Could not save submission. Check permissions and try again.</p> : null}
        {saveMut.isSuccess ? <p className="text-sm text-emerald-700">Submission saved.</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!editable || saveMut.isPending}
            onClick={() => saveMut.mutate('draft')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={!editable || saveMut.isPending}
            onClick={() => {
              if (window.confirm('Submit this assignment?')) saveMut.mutate('submitted');
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Submit
          </button>
          <Link
            to={courseSlug ? `/learn/${encodeURIComponent(courseSlug)}` : '/my/learning'}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Back to course
          </Link>
        </div>
      </form>
    </div>
  );
}
