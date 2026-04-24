import { cn } from '@/lib/cn';

export type ProgressBarProps = {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
};

const sizeHeights: Record<NonNullable<ProgressBarProps['size']>, string> = {
  sm: 'h-2',
  md: 'h-2.5',
  lg: 'h-3.5',
};

export function ProgressBar({ value, size = 'md', showLabel = false }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <div className="w-full space-y-1">
      <div
        className={cn('w-full overflow-hidden rounded-full bg-slate-100', sizeHeights[size])}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-slate-900 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {showLabel ? <p className="text-xs text-slate-600">{Math.round(pct)}% complete</p> : null}
    </div>
  );
}
