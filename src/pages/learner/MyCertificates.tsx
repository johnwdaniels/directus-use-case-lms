import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ScrollText } from 'lucide-react';
import { fetchMyCertificates } from '@/api/learner';
import { hasDirectusEnv } from '@/lib/directus';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CertificateViewer } from '@/components/certificates/CertificateViewer';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import type { UnknownRecord } from '@/api/public';

function thumbnailSrcDoc(html: string): string {
  const safe = html.slice(0, 8000);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>html,body{margin:0;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;transform:scale(0.35);transform-origin:center;width:285%;height:285%;}</style></head><body>${safe}</body></html>`;
}

export default function MyCertificates() {
  const { data: user } = useCurrentUser();
  const [active, setActive] = useState<UnknownRecord | null>(null);
  const enabled = hasDirectusEnv() && Boolean(user?.id);

  const q = useQuery({
    queryKey: ['certificates', user?.id],
    enabled,
    queryFn: () => fetchMyCertificates(user!.id),
  });

  const learnerName =
    `${String(user?.first_name ?? '').trim()} ${String(user?.last_name ?? '').trim()}`.trim() || 'Learner';

  if (!hasDirectusEnv()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-sm text-amber-800">Set VITE_DIRECTUS_URL to load certificates.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EmptyState
          icon={ScrollText}
          title="Sign in"
          description="Log in to view your certificates."
          primaryLabel="Log in"
          onPrimary={() => {
            window.location.href = '/login';
          }}
        />
      </div>
    );
  }

  const rows = (q.data ?? []) as UnknownRecord[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">My certificates</h1>
      <p className="mt-1 text-sm text-slate-600">Official credentials for completed courses.</p>

      {q.isLoading ? <p className="mt-8 text-sm text-slate-500">Loading…</p> : null}

      {!q.isLoading && !rows.length ? (
        <div className="mt-10">
          <EmptyState
            icon={ScrollText}
            title="No certificates yet"
            description="Finish a course that issues a certificate to see it here."
            primaryLabel="Go to My learning"
            onPrimary={() => {
              window.location.href = '/my/learning';
            }}
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const tpl = row.template as UnknownRecord | undefined;
            const html = String(tpl?.html_template ?? '<p style="padding:16px">Certificate</p>');
            const course = row.course as UnknownRecord | undefined;
            const issued = row.issued_at ? format(new Date(String(row.issued_at)), 'PP') : '—';
            return (
              <li key={String(row.id)}>
                <button
                  type="button"
                  onClick={() => setActive(row)}
                  className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  <div className="relative h-40 bg-slate-100">
                    <iframe
                      title=""
                      className="pointer-events-none absolute inset-0 h-full w-full border-0"
                      sandbox=""
                      srcDoc={thumbnailSrcDoc(html)}
                    />
                  </div>
                  <div className="space-y-1 p-4">
                    <h2 className="line-clamp-2 font-semibold text-slate-900">{String(course?.title ?? 'Course')}</h2>
                    <p className="text-xs text-slate-600">Issued {issued}</p>
                    <p className="font-mono text-xs text-slate-500">{String(row.certificate_number ?? '')}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CertificateViewer
        open={Boolean(active)}
        onClose={() => setActive(null)}
        certificate={active}
        learnerName={learnerName}
      />
    </div>
  );
}
