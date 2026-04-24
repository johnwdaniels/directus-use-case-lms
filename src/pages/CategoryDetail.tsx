import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAllCategories, fetchCategoryBySlug, fetchCoursesByCategoryIds } from '@/api/public';
import { hasDirectusEnv } from '@/lib/directus';
import { mapToCourse } from '@/lib/map-entities';
import type { UnknownRecord } from '@/api/public';
import { CourseCard } from '@/components/courses/CourseCard';
import { CoursesFilterSidebar, categoriesToTree, type CategoryTreeNode } from '@/components/courses/CoursesFilterSidebar';
import { parseCatalogUrl, toSearchParams, type CatalogUrlState } from '@/lib/catalog-url';

function collectDescendantIds(node: CategoryTreeNode): string[] {
  return [node.id, ...node.children.flatMap(collectDescendantIds)];
}

export default function CategoryDetail() {
  const { slug } = useParams<{ slug: string }>();
  const hasUrl = hasDirectusEnv();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterState = useMemo(() => parseCatalogUrl(searchParams), [searchParams]);
  const setFilterState = (next: CatalogUrlState) =>
    setSearchParams(toSearchParams({ ...next, category: [] }));

  const catQ = useQuery({
    queryKey: ['category', slug],
    enabled: hasUrl && Boolean(slug),
    queryFn: () => fetchCategoryBySlug(slug!),
  });

  const allCats = useQuery({
    queryKey: ['categories', 'all-tree'],
    enabled: hasUrl,
    queryFn: () => fetchAllCategories(),
  });

  const tree = useMemo(() => categoriesToTree(allCats.data ?? []), [allCats.data]);

  const node = useMemo(() => {
    const find = (nodes: CategoryTreeNode[], s: string): CategoryTreeNode | null => {
      for (const n of nodes) {
        if (n.slug === s) return n;
        const c = find(n.children, s);
        if (c) return c;
      }
      return null;
    };
    return slug ? find(tree, slug) : null;
  }, [tree, slug]);

  const ids = useMemo(() => (node ? collectDescendantIds(node) : []), [node]);

  const coursesQ = useQuery({
    queryKey: ['courses', 'by-category-ids', ids.join(',')],
    enabled: hasUrl && ids.length > 0,
    queryFn: () => fetchCoursesByCategoryIds(ids, -1),
  });

  const filtered = useMemo(() => {
    const rows = (coursesQ.data ?? []) as UnknownRecord[];
    let out = rows;
    if (filterState.difficulty.length) {
      out = out.filter((c) => filterState.difficulty.includes(String(c.difficulty)));
    }
    if (filterState.language.length) {
      out = out.filter((c) => filterState.language.includes(String(c.language)));
    }
    if (filterState.price === 'free') {
      out = out.filter((c) => c.is_free || Number(c.price) === 0);
    }
    if (filterState.price === 'paid') {
      out = out.filter((c) => !c.is_free && Number(c.price) > 0);
    }
    if (filterState.minRating === '4') {
      out = out.filter((c) => Number(c.average_rating) >= 4);
    }
    if (filterState.minRating === '3') {
      out = out.filter((c) => Number(c.average_rating) >= 3);
    }
    const minP = filterState.priceMin ? Number(filterState.priceMin) : null;
    const maxP = filterState.priceMax ? Number(filterState.priceMax) : null;
    if (minP != null && Number.isFinite(minP)) {
      out = out.filter((c) => Number(c.price) >= minP);
    }
    if (maxP != null && Number.isFinite(maxP)) {
      out = out.filter((c) => Number(c.price) <= maxP);
    }
    const dm = (c: UnknownRecord) => Number(c.duration_minutes);
    if (filterState.duration === 'short') {
      out = out.filter((c) => dm(c) < 120);
    } else if (filterState.duration === 'medium') {
      out = out.filter((c) => dm(c) >= 120 && dm(c) <= 600);
    } else if (filterState.duration === 'long') {
      out = out.filter((c) => dm(c) > 600);
    }
    if (filterState.certificate) {
      out = out.filter((c) => c.has_certificate === true);
    }
    return out;
  }, [coursesQ.data, filterState]);

  const c = catQ.data as UnknownRecord | null | undefined;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:px-6">
      <CoursesFilterSidebar
        hideCategory
        categories={tree}
        value={{ ...filterState, category: [] }}
        onChange={(next) => setFilterState({ ...next, category: [] })}
      />
      <div className="min-w-0 flex-1 space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">{String(c?.name ?? slug ?? '')}</h1>
          {c?.description ? <p className="mt-2 max-w-2xl text-slate-600">{String(c.description)}</p> : null}
          <p className="mt-2 text-sm text-slate-500">{c?.course_count != null ? `${c.course_count} courses (including sub-categories)` : ''}</p>
        </header>
        <p className="text-sm text-slate-600">Showing {filtered.length} courses in this branch.</p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((raw) => (
            <CourseCard key={String(raw.id)} course={mapToCourse(raw)} variant="catalog" />
          ))}
        </div>
      </div>
    </div>
  );
}
