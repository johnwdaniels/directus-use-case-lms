import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { RichTextEditor } from '@/components/content/RichTextEditor';
import type { UnknownRecord } from '@/api/public';
import {
  createQuestion,
  createQuestionOption,
  deleteQuestion,
  deleteQuestionOption,
  updateQuestion,
  updateQuestionOption,
  updateQuiz,
} from '@/api/instructor';

const Q_TYPES = ['single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay'] as const;

function SortableQ({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-slate-200 bg-white p-3 ${isDragging ? 'opacity-70 shadow-md' : ''}`}
    >
      <div className="flex gap-2">
        <button type="button" className="mt-1 text-slate-400 hover:text-slate-700" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export type QuizEditorProps = {
  quiz: UnknownRecord;
  onSaved: () => void;
};

export function QuizEditor({ quiz, onSaved }: QuizEditorProps) {
  const quizId = String(quiz.id);
  const [title, setTitle] = useState(String(quiz.title ?? ''));
  const [description, setDescription] = useState(String(quiz.description ?? ''));
  const [timeLimit, setTimeLimit] = useState(Number(quiz.time_limit_minutes ?? 0) || '');
  const [maxAttempts, setMaxAttempts] = useState(Number(quiz.max_attempts ?? 0) || '');
  const [passing, setPassing] = useState(Number(quiz.passing_score ?? 70));
  const [shuffleQ, setShuffleQ] = useState(Boolean(quiz.shuffle_questions));
  const [shuffleO, setShuffleO] = useState(Boolean(quiz.shuffle_options));
  const [showCorrect, setShowCorrect] = useState(String(quiz.show_correct_answers ?? 'after_pass'));
  const [showResults, setShowResults] = useState(Boolean(quiz.show_results_immediately));

  const questions = useMemo(() => [...((quiz.questions as UnknownRecord[]) ?? [])].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)), [quiz.questions]);
  const [localQs, setLocalQs] = useState(questions);
  useEffect(() => {
    setLocalQs(questions);
  }, [questions]);
  const ids = localQs.map((q) => String(q.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      setLocalQs((qs) => {
        const oi = qs.findIndex((x) => String(x.id) === String(active.id));
        const ni = qs.findIndex((x) => String(x.id) === String(over.id));
        if (oi < 0 || ni < 0) return qs;
        const next = arrayMove(qs, oi, ni);
        void Promise.all(
          next.map((row, i) => updateQuestion(String(row.id), { sort_order: i })),
        ).then(() => onSaved());
        return next;
      });
    },
    [onSaved],
  );

  async function saveMeta() {
    await updateQuiz(quizId, {
      title,
      description,
      time_limit_minutes: timeLimit === '' ? null : Number(timeLimit),
      max_attempts: maxAttempts === '' ? null : Number(maxAttempts),
      passing_score: passing,
      shuffle_questions: shuffleQ,
      shuffle_options: shuffleO,
      show_correct_answers: showCorrect,
      show_results_immediately: showResults,
    });
    onSaved();
  }

  async function addQuestion(type: string) {
    const row = await createQuestion(quizId, {
      question_type: type,
      prompt: '<p>New question</p>',
      points: 1,
      sort_order: localQs.length,
      required: true,
    });
    setLocalQs((q) => [...q, row]);
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Title</span>
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Passing score (%)</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={passing}
            onChange={(e) => setPassing(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Description</span>
        <div className="mt-1 rounded-lg border border-slate-200">
          <RichTextEditor value={description} onChange={setDescription} />
        </div>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Time limit (minutes)</span>
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Max attempts</span>
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)} />
          Shuffle questions
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={shuffleO} onChange={(e) => setShuffleO(e.target.checked)} />
          Shuffle options
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showResults} onChange={(e) => setShowResults(e.target.checked)} />
          Show results immediately
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Show correct answers</span>
        <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={showCorrect} onChange={(e) => setShowCorrect(e.target.value)}>
          <option value="never">Never</option>
          <option value="after_pass">After pass</option>
          <option value="always">Always</option>
        </select>
      </label>
      <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => void saveMeta()}>
        Save quiz settings
      </button>

      <hr className="border-slate-200" />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">Questions</span>
        <select
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = '';
            if (v) void addQuestion(v);
          }}
        >
          <option value="">+ Add question…</option>
          {Q_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {localQs.map((q) => (
              <SortableQ key={String(q.id)} id={String(q.id)}>
                <QuestionCard
                  q={q}
                  onChange={() => onSaved()}
                  onRemove={async () => {
                    await deleteQuestion(String(q.id));
                    setLocalQs((rows) => rows.filter((x) => String(x.id) !== String(q.id)));
                    onSaved();
                  }}
                />
              </SortableQ>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function QuestionCard({ q, onChange, onRemove }: { q: UnknownRecord; onChange: () => void; onRemove: () => Promise<void> }) {
  const [type, setType] = useState(String(q.question_type ?? 'single_choice'));
  const [prompt, setPrompt] = useState(String(q.prompt ?? ''));
  const [points, setPoints] = useState(Number(q.points ?? 1));
  const rawOpts = (q.options as UnknownRecord[] | undefined) ?? [];
  const opts = [...rawOpts].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const choice = ['single_choice', 'multiple_choice', 'true_false'].includes(type);

  async function saveQ() {
    await updateQuestion(String(q.id), { question_type: type, prompt, points });
    onChange();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded border border-slate-200 px-2 py-1 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
          {Q_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
        />
        <span className="text-xs text-slate-500">points</span>
        <button type="button" className="ml-auto text-rose-600 hover:underline text-xs" onClick={() => void onRemove()}>
          <Trash2 className="inline h-3 w-3" /> Delete
        </button>
      </div>
      <RichTextEditor value={prompt} onChange={setPrompt} />
      <button type="button" className="rounded bg-slate-100 px-2 py-1 text-xs font-medium" onClick={() => void saveQ()}>
        Save question
      </button>
      {choice ? (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
          {opts.map((o) => (
            <div key={String(o.id)} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(o.is_correct)}
                onChange={(e) => void updateQuestionOption(String(o.id), { is_correct: e.target.checked }).then(onChange)}
              />
              <input
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
                defaultValue={String(o.label ?? '')}
                onBlur={(e) => void updateQuestionOption(String(o.id), { label: e.target.value }).then(onChange)}
              />
              <button type="button" className="text-xs text-rose-600" onClick={() => void deleteQuestionOption(String(o.id)).then(onChange)}>
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-indigo-600"
            onClick={() =>
              void createQuestionOption(String(q.id), 'Option', false, opts.length).then(() => {
                onChange();
              })
            }
          >
            <Plus className="h-3 w-3" /> Add option
          </button>
        </div>
      ) : null}
    </div>
  );
}
