import { useMemo } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import type { UnknownRecord } from '@/api/public';
import { instructorName } from '@/lib/map-entities';

export type CertificateViewerProps = {
  open: boolean;
  onClose: () => void;
  certificate: UnknownRecord | null;
  learnerName: string;
};

function mergeTemplate(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

export function CertificateViewer({ open, onClose, certificate, learnerName }: CertificateViewerProps) {
  const srcDoc = useMemo(() => {
    if (!certificate) return '';
    const tpl = certificate.template as UnknownRecord | undefined;
    const html = String(tpl?.html_template ?? '');
    if (!html) return `<div style="padding:24px;font-family:system-ui">No template HTML.</div>`;
    const course = certificate.course as UnknownRecord | undefined;
    const courseIns = course?.instructor as UnknownRecord | undefined;
    const issued = certificate.issued_at ? format(new Date(String(certificate.issued_at)), 'PPP') : '—';
    return mergeTemplate(html, {
      learner_name: learnerName || 'Learner',
      course_title: String(course?.title ?? 'Course'),
      completion_date: issued,
      verification_code: String(certificate.verification_code ?? ''),
      instructor_name: courseIns ? instructorName(courseIns) : '',
      grade: certificate.final_grade != null ? String(certificate.final_grade) : '',
      issuer_name: String(tpl?.issuer_name ?? ''),
      issuer_title: String(tpl?.issuer_title ?? ''),
    });
  }, [certificate, learnerName]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Certificate"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Certificate</p>
            <p className="font-mono text-sm text-slate-900">
              {certificate ? String(certificate.certificate_number ?? certificate.id ?? '') : ''}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
          <iframe
            title="Certificate preview"
            className="mx-auto block h-[480px] w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-sm"
            sandbox="allow-same-origin allow-scripts"
            srcDoc={srcDoc}
          />
        </div>
      </div>
    </div>
  );
}
