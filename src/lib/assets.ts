import { getDirectusUrl } from '@/lib/directus';

/** Resolve a Directus file id (or relation object) to a public assets URL. */
export function directusAssetUrl(file: string | { id: string } | null | undefined): string | undefined {
  const base = getDirectusUrl();
  if (!base) return undefined;
  const id = typeof file === 'string' ? file : file?.id;
  if (!id) return undefined;
  return `${base}/assets/${id}`;
}
