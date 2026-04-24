import type { CatalogSort } from '@/api/public';

export type CatalogUrlState = {
  search: string;
  category: string[];
  difficulty: string[];
  language: string[];
  price: 'all' | 'free' | 'paid';
  priceMin: string;
  priceMax: string;
  duration: '' | 'short' | 'medium' | 'long';
  minRating: '' | '3' | '4';
  certificate: boolean;
  sort: CatalogSort;
  page: number;
};

function splitCsv(v: string | null): string[] {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export function defaultCatalogUrlState(): CatalogUrlState {
  return {
    search: '',
    category: [],
    difficulty: [],
    language: [],
    price: 'all',
    priceMin: '',
    priceMax: '',
    duration: '',
    minRating: '',
    certificate: false,
    sort: 'relevance',
    page: 1,
  };
}

export function parseCatalogUrl(searchParams: URLSearchParams): CatalogUrlState {
  const sort = (searchParams.get('sort') as CatalogSort) || 'relevance';
  const validSort: CatalogSort = [
    'relevance',
    'newest',
    'rating',
    'popular',
    'price_asc',
    'price_desc',
  ].includes(sort)
    ? sort
    : 'relevance';

  const priceRaw = searchParams.get('price') || 'all';
  const price = priceRaw === 'free' || priceRaw === 'paid' ? priceRaw : 'all';

  return {
    search: searchParams.get('search') ?? '',
    category: splitCsv(searchParams.get('category')),
    difficulty: splitCsv(searchParams.get('difficulty')),
    language: splitCsv(searchParams.get('language')),
    price,
    priceMin: searchParams.get('price_min') ?? '',
    priceMax: searchParams.get('price_max') ?? '',
    duration: (searchParams.get('duration') as CatalogUrlState['duration']) || '',
    minRating: (searchParams.get('min_rating') as CatalogUrlState['minRating']) || '',
    certificate: searchParams.get('certificate') === '1',
    sort: validSort,
    page: Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1),
  };
}

export function serializeCatalogUrl(state: CatalogUrlState): string {
  const p = new URLSearchParams();
  if (state.search.trim()) p.set('search', state.search.trim());
  if (state.category.length) p.set('category', state.category.join(','));
  if (state.difficulty.length) p.set('difficulty', state.difficulty.join(','));
  if (state.language.length) p.set('language', state.language.join(','));
  if (state.price !== 'all') p.set('price', state.price);
  if (state.priceMin) p.set('price_min', state.priceMin);
  if (state.priceMax) p.set('price_max', state.priceMax);
  if (state.duration) p.set('duration', state.duration);
  if (state.minRating) p.set('min_rating', state.minRating);
  if (state.certificate) p.set('certificate', '1');
  if (state.sort !== 'relevance') p.set('sort', state.sort);
  if (state.page > 1) p.set('page', String(state.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function toSearchParams(state: CatalogUrlState): URLSearchParams {
  const raw = serializeCatalogUrl(state);
  return new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
}
