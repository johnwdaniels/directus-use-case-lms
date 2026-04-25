import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ArrowLeft, Download, Printer, Share2 } from 'lucide-react';
import { fetchMyCertificateById } from '@/api/learner';
import { hasDirectusEnv } from '@/lib/directus';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CertificateRenderer } from '@/components/certificates/CertificateRenderer';

function filename(value: unknown) {
  const raw = value == null || value === '' ? 'certificate' : String(value);
  return raw.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'certificate';
}

export default function CertificateView() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useCurrentUser();
  const certificateRef = useRef<HTMLDivElement | null>(null);
  const [downloadState, setDownloadState] = useState<'idle' | 'working' | 'error'>('idle');
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

  const q = useQuery({
    queryKey: ['certificate', id, user?.id],
    enabled: Boolean(id && user?.id && hasDirectusEnv()),
    queryFn: () => fetchMyCertificateById(id!, user!.id),
  });

  async function downloadPdf() {
    if (!certificateRef.current || !q.data) return;
    setDownloadState('working');
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const image = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(image, 'PNG', 0, 0, 297, 210);
      pdf.save(`${filename(q.data.certificate_number ?? q.data.id)}.pdf`);
      setDownloadState('idle');
    } catch {
      setDownloadState('error');
    }
  }

  async function share() {
    const code = q.data?.verification_code ? String(q.data.verification_code) : '';
    if (!code) return;
    const url = `${window.location.origin}/verify/${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 1800);
    } catch {
      setShareState('error');
    }
  }

  if (!hasDirectusEnv()) {
    return <p className="p-6 text-sm text-amber-800">Set VITE_DIRECTUS_URL to load certificates.</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Link to="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          Log in to view this certificate
        </Link>
      </div>
    );
  }

  if (q.isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-12 text-sm text-slate-600">Loading certificate…</div>;
  }

  if (!q.data) {
    return <div className="mx-auto max-w-6xl px-4 py-12 text-sm text-rose-700">Certificate not found.</div>;
  }

  const certificate = q.data;
  const verifyCode = certificate.verification_code ? String(certificate.verification_code) : '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to="/my/certificates"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-slate-900">Certificate</h1>
          <p className="font-mono text-sm text-slate-500">{String(certificate.certificate_number ?? certificate.id)}</p>
        </div>
        <button
          type="button"
          onClick={() => void downloadPdf()}
          disabled={downloadState === 'working'}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {downloadState === 'working' ? 'Preparing…' : 'Download PDF'}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          disabled={!verifyCode}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          {shareState === 'copied' ? 'Copied' : 'Share'}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      {downloadState === 'error' ? <p className="mb-4 text-sm text-rose-600">Could not generate the PDF. Try printing instead.</p> : null}
      {shareState === 'error' ? <p className="mb-4 text-sm text-rose-600">Could not copy the verification link.</p> : null}

      <div className="rounded-2xl bg-slate-100 p-3 shadow-inner sm:p-6">
        <CertificateRenderer ref={certificateRef} certificate={certificate} />
      </div>
    </div>
  );
}
