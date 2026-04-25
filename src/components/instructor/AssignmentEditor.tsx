import { useState } from 'react';
import { RichTextEditor } from '@/components/content/RichTextEditor';
import type { UnknownRecord } from '@/api/public';
import { updateAssignment } from '@/api/instructor';

const SUB_TYPES = ['file', 'text', 'url'] as const;

export type AssignmentEditorProps = {
  assignment: UnknownRecord;
  onSaved: () => void;
};

export function AssignmentEditor({ assignment, onSaved }: AssignmentEditorProps) {
  const id = String(assignment.id);
  const [title, setTitle] = useState(String(assignment.title ?? ''));
  const [description, setDescription] = useState(String(assignment.description ?? ''));
  const [instructions, setInstructions] = useState(String(assignment.instructions ?? ''));
  const [due, setDue] = useState(assignment.due_date ? String(assignment.due_date).slice(0, 16) : '');
  const [maxPoints, setMaxPoints] = useState(Number(assignment.max_points ?? 100));
  const [passing, setPassing] = useState(Number(assignment.passing_score ?? 70));
  const [allowLate, setAllowLate] = useState(Boolean(assignment.allow_late_submissions));
  const [latePct, setLatePct] = useState(Number(assignment.late_penalty_pct ?? 0));
  const [rubric, setRubric] = useState(String(assignment.rubric ?? ''));
  const rawTypes = assignment.submission_types;
  const initialTypes = Array.isArray(rawTypes) ? (rawTypes as string[]) : typeof rawTypes === 'string' ? JSON.parse(rawTypes || '[]') : [];
  const [types, setTypes] = useState<string[]>(initialTypes.length ? initialTypes : ['file', 'text']);

  function toggleType(t: string) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function save() {
    await updateAssignment(id, {
      title,
      description,
      instructions,
      due_date: due ? new Date(due).toISOString() : null,
      max_points: maxPoints,
      passing_score: passing,
      allow_late_submissions: allowLate,
      late_penalty_pct: latePct,
      submission_types: types,
      rubric,
    });
    onSaved();
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Title</span>
        <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Due date</span>
        <input type="datetime-local" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Max points</span>
          <input type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={maxPoints} onChange={(e) => setMaxPoints(Number(e.target.value))} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Passing score</span>
          <input type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={passing} onChange={(e) => setPassing(Number(e.target.value))} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
        Allow late submissions
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Late penalty (%)</span>
        <input type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={latePct} onChange={(e) => setLatePct(Number(e.target.value))} />
      </label>
      <div className="text-sm">
        <span className="font-medium text-slate-700">Submission types</span>
        <div className="mt-2 flex flex-wrap gap-3">
          {SUB_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
              {t}
            </label>
          ))}
        </div>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Description</span>
        <div className="mt-1 rounded-lg border border-slate-200">
          <RichTextEditor value={description} onChange={setDescription} />
        </div>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Instructions</span>
        <div className="mt-1 rounded-lg border border-slate-200">
          <RichTextEditor value={instructions} onChange={setInstructions} />
        </div>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Rubric</span>
        <div className="mt-1 rounded-lg border border-slate-200">
          <RichTextEditor value={rubric} onChange={setRubric} />
        </div>
      </label>
      <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => void save()}>
        Save assignment
      </button>
    </div>
  );
}
