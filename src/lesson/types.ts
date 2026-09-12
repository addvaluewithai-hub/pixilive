export type LessonCoverage = 'not_covered' | 'covered';
export type LessonUnderstanding = 'unknown' | 'struggling' | 'partial' | 'understood';

export interface LessonBeat {
  id: string;
  sectionId: string;
  title: string;
  objective: string;
  sourceAnchor: string;
}

export interface LessonDefinition {
  id: string;
  title: string;
  language: string;
  fullSource: string;
  beats: readonly LessonBeat[];
}

export interface LessonBeatState {
  coverage: LessonCoverage;
  understanding: LessonUnderstanding;
  misconceptions: string[];
}

export interface LessonDetour {
  topic: string;
  fromBeatId: string;
}

export interface LessonState {
  lessonId: string;
  currentBeatId: string;
  beats: Record<string, LessonBeatState>;
  detours: LessonDetour[];
  updatedAt: string;
}

export interface LessonTutorRuntimeOptions {
  storageKey?: string;
  onStateChange?: (state: LessonState) => void;
}
