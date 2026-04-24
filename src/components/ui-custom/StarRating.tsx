import { useId, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StarRatingProps =
  | {
      mode: 'display';
      value: number;
      /** Optional count label, e.g. number of reviews */
      count?: number;
      className?: string;
    }
  | {
      mode: 'input';
      value: number;
      onChange: (value: number) => void;
      className?: string;
    };

export function StarRating(props: StarRatingProps) {
  const id = useId();
  const stars = useMemo(() => [1, 2, 3, 4, 5] as const, []);

  if (props.mode === 'display') {
    const { value, count, className } = props;
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex items-center gap-0.5" aria-label={`Rating ${value.toFixed(1)} out of 5`}>
          {stars.map((i) => {
            const fill = Math.min(1, Math.max(0, value - (i - 1)));
            return (
              <span key={i} className="relative inline-flex h-5 w-5 text-amber-500">
                <Star className="h-5 w-5 text-slate-300" strokeWidth={1.5} aria-hidden />
                {fill > 0 ? (
                  <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }} aria-hidden>
                    <Star className="h-5 w-5 fill-current text-amber-500" strokeWidth={1.5} />
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
        {count != null ? <span className="text-xs text-slate-500">({count})</span> : null}
      </div>
    );
  }

  const { value, onChange, className } = props;
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHover(null)}
    >
      {stars.map((i) => {
        const active = display >= i;
        const inputId = `${id}-star-${i}`;
        return (
          <label key={i} htmlFor={inputId} className="cursor-pointer p-0.5">
            <span className="sr-only">{i} stars</span>
            <input
              id={inputId}
              type="radio"
              name={`${id}-rating`}
              className="sr-only"
              checked={value === i}
              onChange={() => onChange(i)}
            />
            <Star
              className={cn('h-6 w-6', active ? 'fill-amber-400 text-amber-500' : 'text-slate-300')}
              strokeWidth={1.5}
              aria-hidden
              onMouseEnter={() => setHover(i)}
            />
          </label>
        );
      })}
    </div>
  );
}
