import {
  CirclePlay,
  Edit3,
  ExternalLink,
  File,
  FileText,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { LessonType } from '@/types/lms';

const map: Record<LessonType, LucideIcon> = {
  video: CirclePlay,
  text: FileText,
  pdf: File,
  quiz: HelpCircle,
  assignment: Edit3,
  external_link: ExternalLink,
};

export type LessonIconProps = {
  lessonType: LessonType;
  className?: string;
};

export function LessonIcon({ lessonType, className }: LessonIconProps) {
  const Icon = map[lessonType] ?? FileText;
  return <Icon className={cn('h-4 w-4 shrink-0 text-slate-500', className)} aria-hidden />;
}
