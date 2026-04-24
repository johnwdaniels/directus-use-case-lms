import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Loader2, Search, Tag, User } from 'lucide-react';
import { globalSearchCategories, globalSearchCourses, globalSearchInstructors } from '@/api/public';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export type GlobalSearchProps = {
  open: boolean;
  onClose: () => void;
};

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const debounced = useDebouncedValue(q, 220);

  useEffect(() => {
    if (!open) {
      setQ('');
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const enabled = open && debounced.trim().length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    enabled,
    queryFn: async () => {
      const term = debounced.trim();
      const [courses, categories, instructors] = await Promise.all([
        globalSearchCourses(term),
        globalSearchCategories(term),
        globalSearchInstructors(term),
      ]);
      return { courses, categories, instructors };
    },
  });

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3">
          <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses, categories, instructors…"
            className="h-12 w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
            aria-label="Search query"
          />
          {isFetching ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-400" aria-hidden /> : null}
          <button type="button" className="shrink-0 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-2 text-sm">
          {!enabled ? (
            <p className="px-2 py-6 text-center text-slate-500">Type at least 2 characters…</p>
          ) : (
            <div className="space-y-4 px-1 py-2">
              <Section icon={GraduationCap} title="Courses">
                {(data?.courses ?? []).map((c) => (
                  <button
                    key={String(c.id)}
                    type="button"
                    className="flex w-full rounded-md px-2 py-2 text-left hover:bg-slate-50"
                    onClick={() => go(`/courses/${encodeURIComponent(String(c.slug))}`)}
                  >
                    <span className="font-medium text-slate-900">{String(c.title)}</span>
                  </button>
                ))}
                {!isFetching && (data?.courses?.length ?? 0) === 0 ? <EmptyRow /> : null}
              </Section>
              <Section icon={Tag} title="Categories">
                {(data?.categories ?? []).map((c) => (
                  <button
                    key={String(c.id)}
                    type="button"
                    className="flex w-full rounded-md px-2 py-2 text-left hover:bg-slate-50"
                    onClick={() => go(`/categories/${encodeURIComponent(String(c.slug))}`)}
                  >
                    <span className="font-medium text-slate-900">{String(c.name)}</span>
                  </button>
                ))}
                {!isFetching && (data?.categories?.length ?? 0) === 0 ? <EmptyRow /> : null}
              </Section>
              <Section icon={User} title="Instructors">
                {(data?.instructors ?? []).map((u) => (
                  <button
                    key={String(u.id)}
                    type="button"
                    className="flex w-full rounded-md px-2 py-2 text-left hover:bg-slate-50"
                    onClick={() => go(`/instructors/${encodeURIComponent(String(u.id))}`)}
                  >
                    <span className="font-medium text-slate-900">
                      {String(u.first_name)} {String(u.last_name)}
                    </span>
                    {u.headline ? <span className="ml-2 text-xs text-slate-500">{String(u.headline)}</span> : null}
                  </button>
                ))}
                {!isFetching && (data?.instructors?.length ?? 0) === 0 ? <EmptyRow /> : null}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function EmptyRow() {
  return <p className="px-2 py-1 text-xs text-slate-400">No matches</p>;
}
