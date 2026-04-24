import { useCallback, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/cn';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export type PdfViewerProps = {
  /** URL to a PDF (Directus asset URL with cookies is fine in-browser). */
  fileUrl: string;
  className?: string;
};

export function PdfViewer({ fileUrl, className }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  const filename = useMemo(() => {
    try {
      const u = new URL(fileUrl);
      const last = u.pathname.split('/').filter(Boolean).pop();
      return last && last.endsWith('.pdf') ? last : 'document.pdf';
    } catch {
      return 'document.pdf';
    }
  }, [fileUrl]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setLoadError(null);
    setNumPages(n);
    setPage(1);
  }, []);

  return (
    <div className={cn('space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            className="rounded-md border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[6rem] text-center text-xs text-slate-600">
            Page {numPages ? page : '—'} / {numPages || '—'}
          </span>
          <button
            type="button"
            aria-label="Next page"
            className="rounded-md border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"
            disabled={numPages === 0 || page >= numPages}
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Zoom out"
            className="rounded-md border border-slate-200 p-2 hover:bg-slate-50"
            onClick={() => setScale((s) => Math.max(0.5, Math.round((s - 0.1) * 10) / 10))}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-14 text-center text-xs text-slate-600">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            className="rounded-md border border-slate-200 p-2 hover:bg-slate-50"
            onClick={() => setScale((s) => Math.min(2.5, Math.round((s + 0.1) * 10) / 10))}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <a
            href={fileUrl}
            download={filename}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </a>
        </div>
      </div>

      {loadError ? <p className="text-sm text-rose-700">{loadError}</p> : null}

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(e) => setLoadError(e.message || 'Failed to load PDF')}
          loading={<p className="p-4 text-sm text-slate-600">Loading PDF…</p>}
        >
          <Page pageNumber={page} scale={scale} renderTextLayer renderAnnotationLayer className="mx-auto shadow" />
        </Document>
      </div>
    </div>
  );
}
