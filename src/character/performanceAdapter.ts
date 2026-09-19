import type { PerformanceIntent } from './behaviorPacks';

export interface PerformanceSampleContext {
  weight: number;
  phase: number;
}

/**
 * Standard runtime pose consumed by the shared Rive stage.
 * Every character adapter may translate the same semantic intent differently,
 * but it outputs these normalized runtime offsets. Unsupported anatomy simply
 * returns zero for the corresponding channel.
 */
export interface StandardPerformancePose {
  bodyY: number;
  bodyLean: number;
  headY: number;
  headTilt: number;
  leftHandX: number;
  leftHandY: number;
  rightHandX: number;
  rightHandY: number;
  eyeScale: number;
  browY: number;
  smileOpacity: number;
  neutralOpacity: number;
}

export const zeroPerformancePose: StandardPerformancePose = {
  bodyY: 0,
  bodyLean: 0,
  headY: 0,
  headTilt: 0,
  leftHandX: 0,
  leftHandY: 0,
  rightHandX: 0,
  rightHandY: 0,
  eyeScale: 0,
  browY: 0,
  smileOpacity: 0,
  neutralOpacity: 0,
};

/**
 * Behavior packs stay universal; a character adapter only translates semantic
 * channels into its own performance language. This is the only character-specific
 * layer required when a new mascot/robot/animal/cloud is added.
 */
export interface CharacterPerformanceAdapter {
  readonly id: string;
  sample(intent: PerformanceIntent, context: PerformanceSampleContext): StandardPerformancePose;
  applyPattern?(pose: StandardPerformancePose, pattern: string, phase: number): StandardPerformancePose;
}
