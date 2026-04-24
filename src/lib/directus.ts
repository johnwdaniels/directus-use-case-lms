import { createDirectus, rest } from '@directus/sdk';

const url = (import.meta.env.VITE_DIRECTUS_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const directus = createDirectus(url || 'https://example.invalid').with(
  rest({ credentials: 'include' as RequestCredentials }),
);

export function getDirectusUrl(): string {
  return url;
}

export const publicCourseFilter = {
  _and: [{ status: { _eq: 'Published' as const } }, { visibility: { _eq: 'Public' as const } }],
} as const;
