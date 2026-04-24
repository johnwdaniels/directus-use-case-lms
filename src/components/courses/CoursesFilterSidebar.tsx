import { useMemo, useState } from 'react';
import type { UnknownRecord } from '@/api/public';
import type { CatalogUrlState } from '@/lib/catalog-url';
import { cn } from '@/lib/cn';

const difficulties = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'] as const;
const languages = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese', 'Mandarin', 'Other'] as const;

export type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  children: CategoryTreeNode[];
};

export type CoursesFilterSidebarProps = {
  value: CatalogUrlState;
  onChange: (next: CatalogUrlState) => void;
  categories: CategoryTreeNode[];
  className?: string;
  /** Hide the category tree (e.g. on a single-category landing page). */
  hideCategory?: boolean;
};

function buildExpandedDefault(nodes: CategoryTreeNode[]) {
  const m: Record<string, boolean> = {};
  for (const n of nodes) m[n.id] = true;
  return m;
}

export function CoursesFilterSidebar({ value, onChange, categories, className, hideCategory }: CoursesFilterSidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => buildExpandedDefault(categories));

  const toggleCat = (slug: string) => {
    const set = new Set(value.category);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    onChange({ ...value, category: [...set], page: 1 });
  };

  const toggleDiff = (d: string) => {
    const set = new Set(value.difficulty);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    onChange({ ...value, difficulty: [...set], page: 1 });
  };

  const toggleLang = (lang: string) => {
    const set = new Set(value.language);
    if (set.has(lang)) set.delete(lang);
    else set.add(lang);
    onChange({ ...value, language: [...set], page: 1 });
  };

  const tree = useMemo(() => categories, [categories]);

  return (
    <aside
      className={cn(
        'sticky top-20 w-full shrink-0 space-y-6 self-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:w-[260px]',
        className,
      )}
    >
      {!hideCategory ? (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</h2>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
            {tree.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left font-medium text-slate-800 hover:bg-slate-50"
                  onClick={() => setExpanded((e) => ({ ...e, [node.id]: !e[node.id] }))}
                >
                  <span className="text-slate-400">{expanded[node.id] ? '▾' : '▸'}</span>
                  {node.name}
                </button>
                {expanded[node.id] ? (
                  <ul className="ml-3 mt-1 space-y-1 border-l border-slate-100 pl-2">
                    <li>
                      <label className="flex cursor-pointer items-center gap-2 py-0.5">
                        <input type="checkbox" checked={value.category.includes(node.slug)} onChange={() => toggleCat(node.slug)} />
                        <span>{node.name}</span>
                      </label>
                    </li>
                    {node.children.map((ch) => (
                      <li key={ch.id}>
                        <label className="flex cursor-pointer items-center gap-2 py-0.5">
                          <input type="checkbox" checked={value.category.includes(ch.slug)} onChange={() => toggleCat(ch.slug)} />
                          <span>{ch.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Difficulty</h2>
        <div className="mt-2 space-y-1">
          {difficulties.map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={value.difficulty.includes(d)} onChange={() => toggleDiff(d)} />
              {d}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Language</h2>
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {languages.map((lang) => (
            <label key={lang} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={value.language.includes(lang)} onChange={() => toggleLang(lang)} />
              {lang}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['all', 'free', 'paid'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium capitalize',
                value.price === p ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50',
              )}
              onClick={() => onChange({ ...value, price: p, page: 1 })}
            >
              {p === 'all' ? 'All' : p}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min"
            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
            value={value.priceMin}
            onChange={(e) => onChange({ ...value, priceMin: e.target.value, page: 1 })}
          />
          <input
            type="number"
            min={0}
            placeholder="Max"
            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
            value={value.priceMax}
            onChange={(e) => onChange({ ...value, priceMax: e.target.value, page: 1 })}
          />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</h2>
        <div className="mt-2 flex flex-col gap-1 text-sm">
          {[
            { id: '' as const, label: 'Any' },
            { id: 'short' as const, label: 'Short (under 2h)' },
            { id: 'medium' as const, label: 'Medium (2–10h)' },
            { id: 'long' as const, label: 'Long (over 10h)' },
          ].map((opt) => (
            <label key={opt.id || 'any'} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="dur"
                checked={value.duration === opt.id}
                onChange={() => onChange({ ...value, duration: opt.id, page: 1 })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rating</h2>
        <div className="mt-2 space-y-1 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="stars"
              checked={value.minRating === ''}
              onChange={() => onChange({ ...value, minRating: '', page: 1 })}
            />
            Any
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="stars"
              checked={value.minRating === '4'}
              onChange={() => onChange({ ...value, minRating: '4', page: 1 })}
            />
            4+ stars
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="stars"
              checked={value.minRating === '3'}
              onChange={() => onChange({ ...value, minRating: '3', page: 1 })}
            />
            3+ stars
          </label>
        </div>
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.certificate}
            onChange={(e) => onChange({ ...value, certificate: e.target.checked, page: 1 })}
          />
          Has certificate
        </label>
        <p className="mt-1 text-[10px] leading-snug text-slate-400">
          Requires a <code className="rounded bg-slate-100 px-0.5">has_certificate</code> boolean on courses in Directus; URL param is kept for when the field exists.
        </p>
      </div>

      <button
        type="button"
        className="w-full rounded-md border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        onClick={() =>
          onChange({
            search: '',
            category: [],
            difficulty: [],
            language: [],
            price: 'all',
            priceMin: '',
            priceMax: '',
            duration: '',
            minRating: '',
            certificate: false,
            sort: 'relevance',
            page: 1,
          })
        }
      >
        Clear filters
      </button>
    </aside>
  );
}

function parentKey(row: UnknownRecord): string | null {
  const p = row.parent;
  if (p == null || p === '') return null;
  if (typeof p === 'string') return p;
  if (typeof p === 'object' && p && 'id' in (p as object)) return String((p as { id: string }).id);
  return null;
}

export function categoriesToTree(flat: UnknownRecord[]): CategoryTreeNode[] {
  const byParent = new Map<string | null, UnknownRecord[]>();
  for (const row of flat) {
    const pid = parentKey(row);
    const list = byParent.get(pid) ?? [];
    list.push(row);
    byParent.set(pid, list);
  }
  const roots = byParent.get(null) ?? [];
  const sortCat = (a: UnknownRecord, b: UnknownRecord) =>
    (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.name).localeCompare(String(b.name));
  const build = (row: UnknownRecord): CategoryTreeNode => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    children: (byParent.get(String(row.id)) ?? []).sort(sortCat).map(build),
  });
  return roots.sort(sortCat).map(build);
}
