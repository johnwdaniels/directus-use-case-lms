import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  primaryLabel: string;
  onPrimary?: () => void;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryLabel,
  onPrimary,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <Icon className="h-8 w-8 text-slate-500" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-2 max-w-md text-sm text-slate-600">{description}</p> : null}
      {onPrimary ? (
        <button
          type="button"
          className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
      ) : (
        <span className="mt-6 rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700">{primaryLabel}</span>
      )}
    </div>
  );
}
