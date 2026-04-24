import { useQuery } from '@tanstack/react-query';
import { readMe } from '@directus/sdk';
import { directus, hasDirectusEnv } from '@/lib/directus';

export type CurrentUser = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export function useCurrentUser() {
  const enabled = hasDirectusEnv();

  return useQuery({
    queryKey: ['me'],
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        const read = () =>
          directus.request(
            readMe({
              fields: ['id', 'email', 'first_name', 'last_name'],
            }),
          );
        let me;
        try {
          me = await read();
        } catch {
          await directus.refresh();
          me = await read();
        }
        return me as CurrentUser;
      } catch {
        return null;
      }
    },
  });
}
