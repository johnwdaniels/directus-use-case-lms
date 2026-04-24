import { formatDistanceToNow } from 'date-fns';
import { Pin } from 'lucide-react';
import { directusAssetUrl } from '@/lib/assets';
import { RichText } from '@/components/content/RichText';
import { cn } from '@/lib/cn';

export type AnnouncementProps = {
  pinned?: boolean;
  authorName: string;
  authorAvatar?: string | { id: string } | null;
  title: string;
  /** Stored as markdown or limited HTML — rendered via `RichText`. */
  body: string;
  published_at: string | Date;
  className?: string;
};

export function Announcement({
  pinned,
  authorName,
  authorAvatar,
  title,
  body,
  published_at,
  className,
}: AnnouncementProps) {
  const when = typeof published_at === 'string' ? new Date(published_at) : published_at;
  const relative = formatDistanceToNow(when, { addSuffix: true });
  const avatar = directusAssetUrl(authorAvatar ?? null);

  return (
    <article
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-transparent',
        pinned && 'border-amber-200 ring-amber-100',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-200">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                <Pin className="h-3.5 w-3.5" aria-hidden />
                Pinned
              </span>
            ) : null}
            <span className="text-sm font-semibold text-slate-900">{authorName}</span>
            <span className="text-xs text-slate-500">{relative}</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <RichText content={body} className="prose-sm" />
        </div>
      </div>
    </article>
  );
}
