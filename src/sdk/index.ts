export { NovaLiveController } from './NovaLiveController';
export type { NovaLiveControllerOptions, NovaLiveControllerEvents } from './NovaLiveController';
export { NovaLessonController } from './NovaLessonController';
export type { NovaLessonControllerOptions } from './NovaLessonController';
export { NovaFlightController } from './NovaFlightController';
export type { FlyToOptions, Point2D } from './NovaFlightController';
export { PixiLiveNovaElement, definePixiLiveNovaElement } from './PixiLiveNovaElement';
export { LessonTutorRuntime } from '../lesson/LessonTutorRuntime';
export { earthLesson } from '../lesson/earthLesson';
export type {
  LessonDefinition,
  LessonBeat,
  LessonState,
  LessonBeatState,
  LessonCoverage,
  LessonUnderstanding,
  LessonDetour,
  LessonTutorRuntimeOptions,
} from '../lesson/types';
export type { LiveClientTool, LiveClientToolDeclaration } from '../live/types';
export type { PerformanceCue, CharacterAffect, CharacterGesture, CharacterMode } from '../character/performance';

export const PIXILIVE_SDK_VERSION = '0.1.0-alpha.1';
