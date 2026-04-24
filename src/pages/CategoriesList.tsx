import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAllCategories } from '@/api/public';
import { hasDirectusEnv } from '@/lib/directus';
import { categoriesToTree, type CategoryTreeNode } from '@/components/courses/CoursesFilterSidebar';

function CategoryBlock({ node }: { node: CategoryTreeNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Link to={`/categories/${encodeURIComponent(node.slug)}`} className="text-xl font-semibold text-slate-900 hover:text-indigo-700">
        {node.name}
      </Link>
      {node.children.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {node.children.map((ch) => (
            <Link
              key={ch.id}
              to={`/categories/${encodeURIComponent(ch.slug)}`}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-800 hover:border-indigo-200 hover:bg-indigo-50"
            >
              {ch.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CategoriesList() {
  const hasUrl = hasDirectusEnv();
  const q = useQuery({
    queryKey: ['categories', 'all-tree'],
    enabled: hasUrl,
    queryFn: () => fetchAllCategories(),
  });
  const tree = categoriesToTree(q.data ?? []);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Categories</h1>
        <p className="mt-2 text-slate-600">Explore courses by topic. Select a parent category or a sub-topic.</p>
      </div>
      {!hasUrl ? <p className="text-sm text-amber-800">Set VITE_DIRECTUS_URL to load categories.</p> : null}
      {q.isError ? <p className="text-sm text-rose-600">Could not load categories.</p> : null}
      <div className="space-y-6">
        {tree.map((node) => (
          <CategoryBlock key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
