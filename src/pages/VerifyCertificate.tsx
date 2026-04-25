import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { fetchCertificateByCode } from '@/api/public';
import { hasDirectusEnv } from '@/lib/directus';
import { CertificateRenderer } from '@/components/certificates/CertificateRenderer';
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
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
          <h1 className="mt-3 text-2xl font-bold text-emerald-950">Certificate verified</h1>
          <p className="mt-1 text-sm text-emerald-900/80">This credential was issued by the platform.</p>
          <p className="mt-2 font-mono text-xs text-emerald-900">{String(row.certificate_number ?? row.id ?? '')}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 shadow-inner sm:p-6">
          <CertificateRenderer certificate={row} />
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
