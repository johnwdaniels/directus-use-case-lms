import { createDirectus, rest } from '@directus/sdk';

const envRaw = ((import.meta.env.VITE_DIRECTUS_URL as string | undefined) ?? '').trim().replace(/\/$/, '');

/** True when `VITE_DIRECTUS_URL` is set. */
export function hasDirectusEnv(): boolean {
  return Boolean(envRaw);
}

/**
 * Absolute API base. In dev, `VITE_DIRECTUS_URL=/directus` → same-origin + Vite proxy (fixes CORS).
 */
export function getDirectusUrl(): string {
  if (!envRaw) return '';
  if (/^https?:\/\//i.test(envRaw)) return envRaw;
  if (envRaw.startsWith('/')) {
    if (typeof window !== 'undefined') return `${window.location.origin}${envRaw}`;
    return '';
  }
  return envRaw;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any;

function getClient() {
  if (!_client) {
    const base = getDirectusUrl() || 'https://example.invalid';
    _client = createDirectus(base).with(rest({ credentials: 'include' as RequestCredentials }));
  }
  return _client;
}

/** Lazy init for path-based URL; typed as `any` so callers work without a generated schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const directus: any = new Proxy(
  {},
  {
    get(_, prop) {
      const c = getClient();
      const v = Reflect.get(c, prop, c);
      return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(c) : v;
    },
  },
);

/**
 * Do **not** filter courses by `status` / `visibility` in the client: many Public roles cannot read
 * those fields (Directus returns 403). Scope published/public rows with **Item Permissions** on
 * the `courses` collection for the Public role instead.
 */
