export type LessonCoverage = 'not_covered' | 'covered';
export type LessonUnderstanding = 'unknown' | 'struggling' | 'partial' | 'understood';

export type BoardCanvasVariant = 'coasts' | 'ridge' | 'plates' | 'ratio-bars' | 'fraction-circle';
export type BoardImageScene = 'fossil' | 'pangaea' | 'mountains' | 'gps' | 'recipe' | 'map' | 'satellite';

export type LessonBoard =
  | {
      type: 'canvas';
      variant: BoardCanvasVariant;
      title?: string;
      caption?: string;
    }
  | {
      type: 'text';
      eyebrow?: string;
      headline: string;
      body?: string;
      chips?: string[];
    }
  | {
      type: 'timeline';
      title?: string;
      items: Array<{ value: string; label: string }>;
    }
  | {
      type: 'image';
      scene: BoardImageScene;
      title: string;
      caption: string;
    }
  | {
      type: 'compare';
      left: { title: string; body: string };
      right: { title: string; body: string };
      center?: string;
    }
  | {
      type: 'equation';
      parts: string[];
      result: string;
      caption?: string;
    }
  | {
      type: 'choices';
      prompt?: string;
      choices: string[];
      hint?: string;
    }
  | {
      type: 'diagram';
      title?: string;
      nodes: Array<{ title: string; subtitle?: string }>;
      arrows?: string[];
    }
  | {
      type: 'meter';
      label: string;
      value: string;
      secondary?: string;
    }
  | {
      type: 'cards';
      title?: string;
      items: Array<{ title: string; body: string }>;
    };

export interface LessonBeat {
  id: string;
  sectionId: string;
  title: string;
  objective: string;
  sourceAnchor: string;
  /** Canonical Egyptian-Arabic teaching copy for the normal path. */
  script: string;
  /** Canonical content-bearing check that follows the base script. */
  check: string;
  /** What learner evidence is sufficient to pass this beat. */
  passEvidence: string;
  /** What the learner sees on the board while this beat is active. */
  board: LessonBoard;
}

export interface LessonSection {
  id: string;
  title: string;
}

export interface LessonDefinition {
  id: string;
  title: string;
  subtitle?: string;
  language: string;
  curriculumId: string;
  curriculumTitle: string;
  subject: string;
  sections: readonly LessonSection[];
  /** Kept with lesson data for authoring/reference; it is not injected into the Live system prompt. */
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
