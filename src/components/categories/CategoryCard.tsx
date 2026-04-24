import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { FolderTree } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type CategoryCardProps = {
  name: string;
  slug: string;
  icon?: string | null;
  courseCount?: number | null;
  className?: string;
};

function resolveIcon(name?: string | null): LucideIcon {
  if (!name) return FolderTree;
  const exact = Icons[name as keyof typeof Icons] as LucideIcon | undefined;
  if (exact) return exact;
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('') as keyof typeof Icons;
  const Icon = Icons[pascal] as LucideIcon | undefined;
  return Icon ?? FolderTree;
}

export function CategoryCard({ name, slug, icon, courseCount, className }: CategoryCardProps) {
  const Icon = resolveIcon(icon);
  const count = courseCount ?? 0;

  return (
    <Link
      to={`/categories/${encodeURIComponent(slug)}`}
      className={cn(
        'flex min-w-[10.5rem] shrink-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">
          {count} course{count === 1 ? '' : 's'}
        </p>
      </div>
    </Link>
  );
}
