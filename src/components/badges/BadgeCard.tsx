import { formatDistanceToNow } from 'date-fns';
import type { UnknownRecord } from '@/api/public';
import { directusAssetUrl } from '@/lib/assets';

export type BadgeCardProps = {
  award: UnknownRecord;
};

function criteriaLabel(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

export function BadgeCard({ award }: BadgeCardProps) {
  const badge = (award.badge && typeof award.badge === 'object' ? award.badge : {}) as UnknownRecord;
  const icon = directusAssetUrl(badge.icon as string | { id: string } | null | undefined);
  const when = award.awarded_at
    ? `${formatDistanceToNow(new Date(String(award.awarded_at)), { addSuffix: true })}`
    : 'Award date unknown';
  const context = award.awarded_context != null ? String(award.awarded_context) : '';
  const description = badge.description != null ? String(badge.description) : '';
  const criteria = criteriaLabel(badge.criteria_value);
  const color = badge.color ? String(badge.color) : '#4f46e5';

  return (
    <article className="group relative flex h-full gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-2xl"
        style={{ backgroundColor: `${color}22` }}
      >
        {icon ? <img src={icon} alt="" className="h-full w-full object-cover" loading="lazy" /> : 'Badge'}
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold text-slate-900">{String(badge.name ?? 'Badge')}</h2>
        <p className="text-xs text-slate-500">Awarded {when}</p>
        {context ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{context}</p> : null}
      </div>

      <div
        role="tooltip"
        className="pointer-events-none absolute left-4 right-4 top-[calc(100%-0.5rem)] z-20 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 opacity-0 shadow-xl transition group-hover:translate-y-2 group-hover:opacity-100 group-focus-within:translate-y-2 group-focus-within:opacity-100"
      >
        <p className="font-semibold text-slate-900">{String(badge.name ?? 'Badge')}</p>
        {description ? <p className="mt-1">{description}</p> : <p className="mt-1 text-slate-500">No description provided.</p>}
        {criteria ? (
          <div className="mt-3 rounded-lg bg-slate-50 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Criteria {badge.criteria_type ? `(${String(badge.criteria_type).replace(/_/g, ' ')})` : ''}
            </p>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-slate-700">{criteria}</pre>
          </div>
        ) : null}
      </div>
    </article>
  );
}
