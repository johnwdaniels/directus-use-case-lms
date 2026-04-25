import { useQuery } from '@tanstack/react-query';
import { readMe } from '@directus/sdk';
import { directus, hasDirectusEnv } from '@/lib/directus';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readMeAny = readMe as any;

export type CurrentUser = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  /** Present when `readMe` includes `role.name` (used for learner vs instructor UX). */
  role?: { name?: string | null } | string | null;
};

export function useCurrentUser() {
  const enabled = hasDirectusEnv();

  return useQuery({
    queryKey: ['me'],
    enabled,
    retry: false,
    queryFn: async () => {
      const readBase = () =>
        directus.request(
          readMeAny({
            fields: ['id', 'email', 'first_name', 'last_name'],
          }),
        );
      const readWithRole = () =>
        directus.request(
          readMeAny({
            fields: ['id', 'email', 'first_name', 'last_name', 'role.name'],
          }),
        );
      try {
        let me;
        try {
          try {
            me = await readWithRole();
          } catch {
            me = await readBase();
          }
        } catch {
          await directus.refresh();
          try {
            me = await readWithRole();
          } catch {
            me = await readBase();
          }
        }
        return me as CurrentUser;
      } catch {
        return null;
      }
    },
  });
}
