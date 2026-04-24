import { Link } from 'react-router-dom';

export type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
      <Link to="/" className="mt-8 inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900">
        ← Back to home
      </Link>
    </div>
  );
}
