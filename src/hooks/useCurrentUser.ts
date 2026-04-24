import { useQuery } from '@tanstack/react-query';
import { readMe } from '@directus/sdk';
import { directus, getDirectusUrl } from '@/lib/directus';

export type CurrentUser = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export function useCurrentUser() {
  const enabled = Boolean(getDirectusUrl());

  return useQuery({
    queryKey: ['me'],
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        const me = await directus.request(
          readMe({
            fields: ['id', 'email', 'first_name', 'last_name'],
          }),
        );
        return me as CurrentUser;
      } catch {
        return null;
      }
    },
  });
}
