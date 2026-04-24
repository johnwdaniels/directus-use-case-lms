import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { fetchCertificateByCode } from '@/api/public';
import { hasDirectusEnv } from '@/lib/directus';
import { instructorName } from '@/lib/map-entities';
import type { UnknownRecord } from '@/api/public';

export default function VerifyCertificate() {
  const { code } = useParams<{ code: string }>();
  const hasUrl = hasDirectusEnv();

  const q = useQuery({
    queryKey: ['certificate', code],
    enabled: hasUrl && Boolean(code),
    queryFn: () => fetchCertificateByCode(code!),
  });

  const row = q.data as UnknownRecord | null | undefined;

  const learner =
    row?.user && typeof row.user === 'object'
      ? `${String((row.user as UnknownRecord).first_name ?? '')} ${String((row.user as UnknownRecord).last_name ?? '')}`.trim()
      : '';
  const courseTitle =
    row?.course && typeof row.course === 'object' ? String((row.course as UnknownRecord).title ?? '') : '';
  const courseIns = row?.course && typeof row.course === 'object' ? ((row.course as UnknownRecord).instructor as UnknownRecord | undefined) : undefined;
  const instructorNm = courseIns ? instructorName(courseIns) : '';

  if (!hasUrl) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-amber-800">Set VITE_DIRECTUS_URL to verify certificates.</p>
      </div>
    );
  }

  if (q.isSuccess && !row) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Certificate not found</h1>
        <p className="mt-3 text-slate-600">We could not find a certificate for this verification code. Check the code and try again.</p>
      </div>
    );
  }

  if (row) {
    const issued = row.issued_at ? format(new Date(String(row.issued_at)), 'PPP') : '—';
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-emerald-950">Certificate verified</h1>
          <p className="mt-1 text-sm text-emerald-900/80">This credential was issued by the platform.</p>
          <dl className="mt-8 space-y-3 text-left text-sm">
            <div className="flex justify-between gap-4 border-b border-emerald-100 pb-2">
              <dt className="text-emerald-800/80">Certificate #</dt>
              <dd className="font-mono font-medium text-emerald-950">{String(row.certificate_number ?? row.id ?? '')}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-emerald-100 pb-2">
              <dt className="text-emerald-800/80">Learner</dt>
              <dd className="font-medium text-emerald-950">{learner || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-emerald-100 pb-2">
              <dt className="text-emerald-800/80">Course</dt>
              <dd className="text-right font-medium text-emerald-950">{courseTitle || '—'}</dd>
            </div>
            {instructorNm ? (
              <div className="flex justify-between gap-4 border-b border-emerald-100 pb-2">
                <dt className="text-emerald-800/80">Instructor</dt>
                <dd className="font-medium text-emerald-950">{instructorNm}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-b border-emerald-100 pb-2">
              <dt className="text-emerald-800/80">Issued</dt>
              <dd className="font-medium text-emerald-950">{issued}</dd>
            </div>
            {row.final_grade != null && row.final_grade !== '' ? (
              <div className="flex justify-between gap-4 pt-1">
                <dt className="text-emerald-800/80">Final grade</dt>
                <dd className="font-medium text-emerald-950">{String(row.final_grade)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-slate-600">
      {q.isFetching ? <p>Checking certificate…</p> : q.isError ? <p className="text-rose-600">Unable to verify right now.</p> : null}
    </div>
  );
}
