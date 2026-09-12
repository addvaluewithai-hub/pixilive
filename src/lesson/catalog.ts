import { earthLesson } from './earthLesson';
import { ratioLesson } from './ratioLesson';
import type { LessonDefinition } from './types';

export interface CurriculumGroup {
  id: string;
  title: string;
  subtitle: string;
  lessons: readonly LessonDefinition[];
}

export const lessonCatalog: readonly CurriculumGroup[] = [
  {
    id: 'science',
    title: 'العلوم',
    subtitle: 'الأرض والفضاء والطبيعة',
    lessons: [earthLesson],
  },
  {
    id: 'math',
    title: 'الرياضيات',
    subtitle: 'مفاهيم وتطبيقات من الحياة',
    lessons: [ratioLesson],
  },
];

export const allLessons: readonly LessonDefinition[] = lessonCatalog.flatMap((curriculum) => curriculum.lessons);

export const defaultLesson = earthLesson;

export function findLesson(lessonId: string | null | undefined): LessonDefinition {
  return allLessons.find((lesson) => lesson.id === lessonId) ?? defaultLesson;
}
