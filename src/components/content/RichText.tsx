import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/cn';

export type RichTextProps = {
  /** Markdown (GFM) and/or limited HTML depending on CMS storage. */
  content: string;
  className?: string;
};

export function RichText({ content, className }: RichTextProps) {
  if (!content?.trim()) {
    return <div className={cn('prose prose-slate max-w-none text-sm text-slate-500', className)}>No content.</div>;
  }

  return (
    <div className={cn('prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-a:text-indigo-700', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
