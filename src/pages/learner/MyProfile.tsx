import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readMe, updateUser, uploadFiles } from '@directus/sdk';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readMeAny = readMe as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateUserAny = updateUser as any;
import { directus, hasDirectusEnv } from '@/lib/directus';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import { User } from 'lucide-react';
import { directusAssetUrl } from '@/lib/assets';
import type { UnknownRecord } from '@/api/public';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const uf = uploadFiles as any;

const meFields = [
  'id',
  'first_name',
  'last_name',
  'email',
  'avatar',
  'bio',
  'headline',
  'social_twitter',
  'social_linkedin',
  'social_youtube',
  'social_website',
] as const;

export default function MyProfile() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const enabled = hasDirectusEnv() && Boolean(user?.id);

  const meQ = useQuery({
    queryKey: ['me', 'profile', user?.id],
    enabled,
    queryFn: async () =>
      directus.request(
        readMeAny({
          fields: [...meFields],
        }),
      ) as Promise<UnknownRecord>,
  });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [headline, setHeadline] = useState('');
  const [tw, setTw] = useState('');
  const [li, setLi] = useState('');
  const [yt, setYt] = useState('');
  const [web, setWeb] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);

  useEffect(() => {
    const m = meQ.data;
    if (!m) return;
    setFirstName(String(m.first_name ?? ''));
    setLastName(String(m.last_name ?? ''));
    setBio(String(m.bio ?? ''));
    setHeadline(String(m.headline ?? ''));
    setTw(String(m.social_twitter ?? ''));
    setLi(String(m.social_linkedin ?? ''));
    setYt(String(m.social_youtube ?? ''));
    setWeb(String(m.social_website ?? ''));
    const av = m.avatar;
    if (typeof av === 'string') setAvatarId(av);
    else if (av && typeof av === 'object' && 'id' in av) setAvatarId(String((av as { id: string }).id));
    else setAvatarId(null);
  }, [meQ.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const id = String(meQ.data?.id ?? user?.id ?? '');
      if (!id) throw new Error('No user');
      await directus.request(
        updateUserAny(id, {
          first_name: firstName || null,
          last_name: lastName || null,
          bio: bio || null,
          headline: headline || null,
          social_twitter: tw || null,
          social_linkedin: li || null,
          social_youtube: yt || null,
          social_website: web || null,
          ...(avatarId ? { avatar: avatarId } : {}),
        }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['me', 'profile'] });
    },
  });

  async function onAvatarFile(f: File | null) {
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    const created = await directus.request(uf(fd));
    const row = Array.isArray(created) ? created[0] : created;
    const id = row && typeof row === 'object' && 'id' in row ? String((row as { id: string }).id) : null;
    if (id) setAvatarId(id);
  }

  if (!hasDirectusEnv()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <p className="text-sm text-amber-800">Set VITE_DIRECTUS_URL to edit your profile.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <EmptyState
          icon={User}
          title="Sign in"
          description="Log in to edit your profile."
          primaryLabel="Log in"
          onPrimary={() => {
            window.location.href = '/login';
          }}
        />
      </div>
    );
  }

  const avatarUrl = avatarId ? directusAssetUrl(avatarId) : directusAssetUrl(meQ.data?.avatar as string | { id: string });

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">My profile</h1>
      <p className="mt-1 text-sm text-slate-600">Update how you appear across the platform.</p>

      {meQ.isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : (
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
        >
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Avatar</label>
              <input
                type="file"
                accept="image/*"
                className="mt-1 text-sm"
                onChange={(e) => void onAvatarFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">First name</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Last name</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Headline</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Bio</label>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Twitter / X</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={tw}
                onChange={(e) => setTw(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">LinkedIn</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={li}
                onChange={(e) => setLi(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">YouTube</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={yt}
                onChange={(e) => setYt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Website</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={web}
                onChange={(e) => setWeb(e.target.value)}
              />
            </div>
          </div>

          {saveMut.isError ? <p className="text-sm text-rose-600">Could not save. Check permissions and try again.</p> : null}
          {saveMut.isSuccess ? <p className="text-sm text-emerald-700">Saved.</p> : null}

          <button
            type="submit"
            disabled={saveMut.isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saveMut.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      )}
    </div>
  );
}
