import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { UnknownRecord } from '@/api/public';

export type TagPickerProps = {
  allTags: UnknownRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function TagPicker({ allTags, selectedIds, onChange, disabled }: TagPickerProps) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return allTags;
    return allTags.filter((t) => String(t.name ?? '').toLowerCase().includes(s));
  }, [allTags, q]);

  const set = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggle(id: string) {
    if (disabled) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search tags…"
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {selectedIds.map((id) => {
          const t = allTags.find((x) => String(x.id) === id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-900"
            >
              {String(t?.name ?? id)}
              <button
                type="button"
                disabled={disabled}
                className="rounded p-0.5 hover:bg-indigo-200"
                aria-label="Remove tag"
                onClick={() => toggle(id)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {filtered.map((t) => {
          const id = String(t.id);
          const active = set.has(id);
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(id)}
              className={`mb-1 w-full rounded px-2 py-1.5 text-left text-sm ${
                active ? 'bg-indigo-50 font-medium text-indigo-900' : 'hover:bg-slate-50'
              }`}
            >
              {String(t.name ?? '')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
