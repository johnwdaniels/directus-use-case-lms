import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchAllCategories, fetchCoursesCatalog, type CatalogFilters, type CatalogSort } from '@/api/public';
import { getDirectusUrl } from '@/lib/directus';
import { mapToCourse } from '@/lib/map-entities';
import { parseCatalogUrl, toSearchParams, type CatalogUrlState } from '@/lib/catalog-url';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CourseCard } from '@/components/courses/CourseCard';
import { CoursesFilterSidebar, categoriesToTree } from '@/components/courses/CoursesFilterSidebar';
import { cn } from '@/lib/cn';

function urlToFilters(s: CatalogUrlState): CatalogFilters {
  const priceFree = s.price === 'free';
  const pricePaid = s.price === 'paid';
  const pm = s.priceMin ? Number.parseFloat(s.priceMin) : undefined;
  const px = s.priceMax ? Number.parseFloat(s.priceMax) : undefined;
  return {
    search: s.search.trim() || undefined,
    categorySlugs: s.category.length ? s.category : undefined,
    difficulties: s.difficulty.length ? s.difficulty : undefined,
    languages: s.language.length ? s.language : undefined,
    priceFree: priceFree || undefined,
    pricePaid: pricePaid || undefined,
    priceMin: Number.isFinite(pm) ? pm : undefined,
    priceMax: Number.isFinite(px) ? px : undefined,
    duration: s.duration || null,
    minRating: s.minRating ? Number(s.minRating) : null,
    hasCertificate: s.certificate || null,
    page: s.page,
    perPage: 24,
    sort: s.sort,
  };
}

const sortOptions: { value: CatalogSort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export default function CoursesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseCatalogUrl(searchParams), [searchParams]);
  const setUrlState = (next: CatalogUrlState) => setSearchParams(toSearchParams(next));

  const [searchInput, setSearchInput] = useState(urlState.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  useEffect(() => {
    setSearchInput(urlState.search);
  }, [urlState.search]);

  useEffect(() => {
    const fromUrl = searchParams.get('search') ?? '';
    if (debouncedSearch === fromUrl) return;
    const next = parseCatalogUrl(searchParams);
    setSearchParams(toSearchParams({ ...next, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch, searchParams, setSearchParams]);

  const hasUrl = Boolean(getDirectusUrl());

  const cats = useQuery({
    queryKey: ['categories', 'all-tree'],
    enabled: hasUrl,
    queryFn: () => fetchAllCategories(),
  });

  const filters = useMemo(() => urlToFilters(urlState), [urlState]);

  const catalog = useQuery({
    queryKey: ['courses', 'catalog', filters],
    enabled: hasUrl,
    queryFn: () => fetchCoursesCatalog(filters),
  });

  const tree = useMemo(() => categoriesToTree(cats.data ?? []), [cats.data]);
  const totalPages = Math.max(1, Math.ceil((catalog.data?.total ?? 0) / 24));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:px-6">
      {!hasUrl ? (
        <p className="text-sm text-amber-800">Configure VITE_DIRECTUS_URL to load the catalog.</p>
      ) : (
        <>
          <CoursesFilterSidebar categories={tree} value={urlState} onChange={setUrlState} />

          <div className="min-w-0 flex-1 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                placeholder="Search courses…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                aria-label="Search courses"
              />
              <div className="flex items-center gap-2">
                <label htmlFor="sort" className="text-xs font-medium text-slate-500">
                  Sort
                </label>
                <select
                  id="sort"
                  className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  value={urlState.sort}
                  onChange={(e) =>
                    setUrlState({ ...urlState, sort: e.target.value as CatalogSort, page: 1 })
                  }
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              {catalog.isFetching ? 'Loading…' : `${catalog.data?.total ?? 0} courses`}
            </p>

            {catalog.isError ? (
              <p className="text-sm text-rose-600">Could not load courses. Check Directus public permissions.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {(catalog.data?.courses ?? []).map((raw) => (
                  <CourseCard key={String(raw.id)} course={mapToCourse(raw)} variant="catalog" />
                ))}
              </div>
            )}

            <nav className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 pt-6" aria-label="Pagination">
              <button
                type="button"
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm',
                  urlState.page <= 1 ? 'cursor-not-allowed opacity-40' : 'border-slate-200 hover:bg-slate-50',
                )}
                disabled={urlState.page <= 1}
                onClick={() => setUrlState({ ...urlState, page: urlState.page - 1 })}
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {urlState.page} of {totalPages}
              </span>
              <button
                type="button"
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm',
                  urlState.page >= totalPages ? 'cursor-not-allowed opacity-40' : 'border-slate-200 hover:bg-slate-50',
                )}
                disabled={urlState.page >= totalPages}
                onClick={() => setUrlState({ ...urlState, page: urlState.page + 1 })}
              >
                Next
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
