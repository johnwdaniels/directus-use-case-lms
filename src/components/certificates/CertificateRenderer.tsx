import { forwardRef, useMemo, type CSSProperties } from 'react';
import { format } from 'date-fns';
import type { UnknownRecord } from '@/api/public';
import { directusAssetUrl } from '@/lib/assets';
import { instructorName } from '@/lib/map-entities';
import { cn } from '@/lib/cn';

export type CertificateRendererProps = {
  certificate: UnknownRecord;
  className?: string;
  compact?: boolean;
};

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function fullName(value: unknown, fallback: string) {
  const row = record(value);
  if (!row) return fallback;
  const name = `${String(row.first_name ?? '').trim()} ${String(row.last_name ?? '').trim()}`.trim();
  return name || String(row.email ?? fallback);
}

function field(value: unknown, fallback = '') {
  return value == null || value === '' ? fallback : String(value);
}

export function mergeCertificateTemplate(html: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.split(`{{${key}}}`).join(value),
    html,
  );
}

export function certificateMergeFields(certificate: UnknownRecord): Record<string, string> {
  const template = record(certificate.template);
  const course = record(certificate.course);
  const instructor = record(course?.instructor);
  const issued = certificate.issued_at ? format(new Date(String(certificate.issued_at)), 'PPP') : '';
  return {
    learner_name: fullName(certificate.user, 'Learner'),
    course_title: field(course?.title, 'Course'),
    completion_date: issued,
    verification_code: field(certificate.verification_code),
    instructor_name: instructor ? instructorName(instructor) : '',
    grade: certificate.final_grade != null ? String(certificate.final_grade) : '',
    issuer_name: field(template?.issuer_name),
    issuer_title: field(template?.issuer_title),
  };
}

function fallbackTemplate() {
  return `
    <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:Georgia,serif;color:#0f172a;padding:48px;">
      <p style="text-transform:uppercase;letter-spacing:.18em;color:var(--certificate-accent);font:700 14px system-ui,sans-serif;">Certificate of Completion</p>
      <h1 style="margin:24px 0 8px;font-size:54px;line-height:1.05;">{{learner_name}}</h1>
      <p style="margin:0;font:20px system-ui,sans-serif;color:#475569;">has successfully completed</p>
      <h2 style="margin:18px 0 0;font-size:36px;line-height:1.15;color:var(--certificate-accent);">{{course_title}}</h2>
      <p style="margin-top:28px;font:16px system-ui,sans-serif;color:#64748b;">Issued {{completion_date}} · Verification {{verification_code}}</p>
    </div>
  `;
}

export const CertificateRenderer = forwardRef<HTMLDivElement, CertificateRendererProps>(
  ({ certificate, className, compact = false }, ref) => {
    const template = record(certificate.template);
    const accent = field(template?.accent_color, '#4f46e5');
    const backgroundUrl = directusAssetUrl(template?.background_image as string | { id: string } | null | undefined);
    const signatureUrl = directusAssetUrl(template?.signature_image as string | { id: string } | null | undefined);
    const html = useMemo(() => {
      const raw = field(template?.html_template) || fallbackTemplate();
      return mergeCertificateTemplate(raw, certificateMergeFields(certificate));
    }, [certificate, template?.html_template]);

    return (
      <div
        ref={ref}
        className={cn(
          'certificate-print-root relative mx-auto aspect-[297/210] w-full overflow-hidden bg-white text-slate-950 shadow-sm',
          compact ? 'rounded-lg border border-slate-200' : 'rounded-2xl border border-slate-200',
          className,
        )}
        style={{
          '--certificate-accent': accent,
          backgroundColor: '#fff',
          backgroundImage: backgroundUrl ? `url("${backgroundUrl}")` : undefined,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        } as CSSProperties}
      >
        <style>
          {`
            .certificate-print-root [data-certificate-html] {
              position: relative;
              z-index: 1;
              height: 100%;
            }
            .certificate-print-root [data-certificate-html] * {
              max-width: 100%;
            }
            @media print {
              body * {
                visibility: hidden !important;
              }
              .certificate-print-root,
              .certificate-print-root * {
                visibility: visible !important;
              }
              .certificate-print-root {
                position: fixed !important;
                inset: 0 !important;
                width: 297mm !important;
                height: 210mm !important;
                border: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                size: A4 landscape;
                margin: 0;
              }
            }
          `}
        </style>
        <div
          data-certificate-html
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt=""
            className="pointer-events-none absolute bottom-[10%] right-[12%] z-10 max-h-[12%] max-w-[24%] object-contain"
            crossOrigin="anonymous"
          />
        ) : null}
      </div>
    );
  },
);

CertificateRenderer.displayName = 'CertificateRenderer';
