import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { Check, ChevronDown, GripVertical, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatDurationMinutes } from '@/lib/format';
import { LessonIcon } from '@/components/courses/LessonIcon';
import { ProgressBar } from '@/components/courses/ProgressBar';
import type { CourseModule, CourseWithCurriculum, Lesson, LessonProgressStatus } from '@/types/lms';

export type CurriculumOutlineVariant = 'preview' | 'player' | 'instructor-editor';

export type CurriculumOutlineProps = {
  course: CourseWithCurriculum;
  variant: CurriculumOutlineVariant;
  progress?: Record<string, LessonProgressStatus>;
  onLessonClick?: (lessonId: string) => void;
  /** When `variant` is `preview`, locked lessons are still visible but not navigable. */
  isEnrolled?: boolean;
  currentLessonId?: string;
  /** Player: overall enrollment progress at top of the outline. */
  overallProgressPct?: number | null;
  /** Instructor editor hooks (Phase 6 wiring). */
  onRenameModule?: (moduleId: string, title: string) => void;
  onRenameLesson?: (lessonId: string, title: string) => void;
  onAddLesson?: (moduleId: string) => void;
  onDeleteLesson?: (lessonId: string) => void;
  onAddModule?: () => void;
  onReorderLessons?: (moduleId: string, orderedLessonIds: string[]) => void;
  onReorderModules?: (orderedModuleIds: string[]) => void;
  onInstructorEditLesson?: (lessonId: string) => void;
};

function moduleDurationMinutes(module: CourseModule): number {
  const lessons = module.lessons ?? [];
  return lessons.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0);
}

function lessonDurationLabel(lesson: Lesson): string {
  const m = lesson.duration_minutes;
  if (m == null || m <= 0) return '—';
  return `${m}m`;
}

function isLessonLockedPreview(lesson: Lesson, isEnrolled: boolean | undefined): boolean {
  if (lesson.is_preview) return false;
  return !isEnrolled;
}

function isLessonClickablePreview(lesson: Lesson, isEnrolled: boolean | undefined): boolean {
  return Boolean(lesson.is_preview) || Boolean(isEnrolled);
}

type LocalModule = CourseModule & { lessons: Lesson[] };

function normalizeModules(modules: CourseModule[] | null | undefined): LocalModule[] {
  return (modules ?? []).map((m) => ({
    ...m,
    lessons: [...(m.lessons ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }));
}

function SortableInstructorLessonRow(props: {
  moduleId: string;
  lesson: Lesson;
  onRenameLesson?: (lessonId: string, title: string) => void;
  onDeleteLesson?: (lessonId: string) => void;
  onEditLesson?: (lessonId: string) => void;
}) {
  const { moduleId, lesson, onRenameLesson, onDeleteLesson, onEditLesson } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `les:${lesson.id}`,
    data: { moduleId, lessonId: lesson.id },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border border-transparent bg-white px-2 py-2 ${
        isDragging ? 'opacity-70 shadow-md ring-2 ring-slate-200' : ''
      }`}
    >
      <button
        type="button"
        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        aria-label="Drag to reorder lesson"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <LessonIcon lessonType={lesson.lesson_type} />
      <input
        className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
        defaultValue={lesson.title}
        aria-label="Lesson title"
        onBlur={(e) => onRenameLesson?.(lesson.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="shrink-0 text-xs text-slate-500">{lessonDurationLabel(lesson)}</span>
      {onEditLesson ? (
        <button
          type="button"
          className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
          aria-label="Edit lesson"
          onClick={() => onEditLesson(lesson.id)}
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
        aria-label="Delete lesson"
        onClick={() => onDeleteLesson?.(lesson.id)}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SortableInstructorModuleShell(props: {
  moduleId: string;
  children: ReactNode;
}) {
  const { moduleId, children } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `mod:${moduleId}`,
    data: { kind: 'module' as const, moduleId },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-slate-200 bg-white p-2 shadow-sm ${isDragging ? 'opacity-80 ring-2 ring-slate-300' : ''}`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="mt-1 rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Drag to reorder module"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function CurriculumOutline({
  course,
  variant,
  progress,
  onLessonClick,
  isEnrolled,
  currentLessonId,
  overallProgressPct,
  onRenameModule,
  onRenameLesson,
  onAddLesson,
  onDeleteLesson,
  onAddModule,
  onReorderLessons,
  onReorderModules,
  onInstructorEditLesson,
}: CurriculumOutlineProps) {
  const modulesSorted = useMemo(() => {
    const base = normalizeModules(course.modules);
    return [...base].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [course.modules]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [localModules, setLocalModules] = useState<LocalModule[]>(modulesSorted);

  useEffect(() => {
    setLocalModules(modulesSorted);
  }, [modulesSorted, course.id]);

  useEffect(() => {
    if (variant !== 'preview') return;
    const first = modulesSorted[0]?.id;
    if (!first) return;
    setExpanded((prev) => (Object.keys(prev).length ? prev : { [first]: true }));
  }, [variant, modulesSorted]);

  useEffect(() => {
    if (variant !== 'player') return;
    const init: Record<string, boolean> = {};
    for (const m of modulesSorted) init[m.id] = true;
    setExpanded(init);
  }, [variant, modulesSorted, course.id]);

  const toggleModule = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const bareLessonId = (id: string) => (id.startsWith('les:') ? id.slice(4) : id);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (variant !== 'instructor-editor') return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setLocalModules((mods) => {
        const activeId = String(active.id);
        const overId = String(over.id);

        if (activeId.startsWith('mod:') && overId.startsWith('mod:')) {
          const a = activeId.slice(4);
          const b = overId.slice(4);
          const mids = mods.map((m) => m.id);
          const oi = mids.indexOf(a);
          const ni = mids.indexOf(b);
          if (oi < 0 || ni < 0) return mods;
          const next = arrayMove(mods, oi, ni);
          onReorderModules?.(next.map((m) => m.id));
          return next;
        }

        if (!activeId.startsWith('les:') || !overId.startsWith('les:')) return mods;

        const activeLes = bareLessonId(activeId);
        const overLes = bareLessonId(overId);
        const fromModule = mods.find((m) => m.lessons.some((l) => l.id === activeLes));
        const toModule = mods.find((m) => m.lessons.some((l) => l.id === overLes));
        if (!fromModule || !toModule) return mods;

        const fromIndex = fromModule.lessons.findIndex((l) => l.id === activeLes);
        const toIndex = toModule.lessons.findIndex((l) => l.id === overLes);
        if (fromIndex < 0 || toIndex < 0) return mods;

        if (fromModule.id === toModule.id) {
          const newLessons = arrayMove(fromModule.lessons, fromIndex, toIndex);
          const next = mods.map((m) => (m.id === fromModule.id ? { ...m, lessons: newLessons } : m));
          onReorderLessons?.(fromModule.id, newLessons.map((l) => l.id));
          return next;
        }

        const moving = fromModule.lessons[fromIndex];
        const fromLessons = fromModule.lessons.filter((l) => l.id !== activeLes);
        const toLessons = [...toModule.lessons];
        toLessons.splice(toIndex, 0, moving);

        const next = mods.map((m) => {
          if (m.id === fromModule.id) return { ...m, lessons: fromLessons };
          if (m.id === toModule.id) return { ...m, lessons: toLessons };
          return m;
        });
        onReorderLessons?.(fromModule.id, fromLessons.map((l) => l.id));
        onReorderLessons?.(toModule.id, toLessons.map((l) => l.id));
        return next;
      });
    },
    [onReorderLessons, onReorderModules, variant],
  );

  const instructorSortableIds = useMemo(
    () => localModules.flatMap((m) => [`mod:${m.id}`, ...m.lessons.map((l) => `les:${l.id}`)]),
    [localModules],
  );

  const dataModules = variant === 'instructor-editor' ? localModules : modulesSorted;

  const moduleBlocks = dataModules.map((mod) => {
    const lessons = mod.lessons ?? [];
    const isOpen = Boolean(expanded[mod.id]);
    const totalMin = moduleDurationMinutes(mod);

    const headerButton = (
      <button
        type="button"
        onClick={() => toggleModule(mod.id)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        aria-expanded={isOpen}
      >
        <span className="min-w-0 flex-1">
          {variant === 'instructor-editor' ? (
            <input
              className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-slate-900 hover:border-slate-200"
              defaultValue={mod.title}
              aria-label="Module title"
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => onRenameModule?.(mod.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <span className="block truncate text-sm font-semibold text-slate-900">{mod.title}</span>
          )}
          <span className="mt-0.5 block text-xs text-slate-600">
            {lessons.length} lessons · {formatDurationMinutes(totalMin)}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-600 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    );

    const inner = (
      <>
        {headerButton}

        {isOpen ? (
          variant === 'instructor-editor' ? (
            <div className="mt-2 space-y-2 px-1 pb-2">
              <div className="space-y-1">
                {lessons.map((lesson) => (
                  <SortableInstructorLessonRow
                    key={lesson.id}
                    moduleId={mod.id}
                    lesson={lesson}
                    onRenameLesson={onRenameLesson}
                    onDeleteLesson={onDeleteLesson}
                    onEditLesson={onInstructorEditLesson}
                  />
                ))}
              </div>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => onAddLesson?.(mod.id)}
              >
                <Plus className="h-4 w-4" />
                Add lesson
              </button>
            </div>
          ) : (
            <ul className="mt-2 space-y-1 px-1 pb-2">
              {lessons.map((lesson) => {
                const status = progress?.[lesson.id];
                const locked = variant === 'preview' && isLessonLockedPreview(lesson, isEnrolled);
                const clickable =
                  variant === 'player' ||
                  (variant === 'preview' && isLessonClickablePreview(lesson, isEnrolled) && !locked);
                const active = variant === 'player' && lesson.id === currentLessonId;

                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => {
                        if (!clickable) return;
                        onLessonClick?.(lesson.id);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                        active ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'hover:bg-slate-50'
                      } ${!clickable ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {active ? <span className="w-1 self-stretch rounded-full bg-indigo-600" aria-hidden /> : null}
                      <LessonIcon lessonType={lesson.lesson_type} />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{lesson.title}</span>
                      <span className="shrink-0 text-xs text-slate-500">{lessonDurationLabel(lesson)}</span>
                      {status === 'completed' ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Completed" />
                      ) : null}
                      {locked ? <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-label="Locked" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </>
    );

    if (variant === 'instructor-editor') {
      return (
        <SortableInstructorModuleShell key={mod.id} moduleId={mod.id}>
          {inner}
        </SortableInstructorModuleShell>
      );
    }

    return (
      <div key={mod.id} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {inner}
      </div>
    );
  });

  return (
    <div className="space-y-3">
      {variant === 'player' && overallProgressPct != null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium text-slate-600">Course progress</p>
          <div className="mt-2">
            <ProgressBar value={Math.min(100, Math.max(0, overallProgressPct))} size="sm" showLabel />
          </div>
        </div>
      ) : null}
      {variant === 'instructor-editor' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={instructorSortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">{moduleBlocks}</div>
          </SortableContext>
        </DndContext>
      ) : (
        moduleBlocks
      )}

      {variant === 'instructor-editor' ? (
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          onClick={() => onAddModule?.()}
        >
          <Plus className="h-4 w-4" />
          Add module
        </button>
      ) : null}
    </div>
  );
}
