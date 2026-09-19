import type { PerformanceIntent } from './behaviorPacks';
import type { Emotion } from './types';

export interface PerformanceSampleContext {
  weight: number;
  phase: number;
}

/**
 * Shared runtime channels consumed by the generic Rive stage. The values can mean
 * different things visually for different characters; an adapter owns that mapping.
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
  /** Optional universal expression channels. Older rigs may simply omit them. */
  frownOpacity?: number;
  expressionMouthOpacity?: number;
  tearOpacity?: number;
  sparkleOpacity?: number;
  blushOpacity?: number;
  browTilt?: number;
  tailTilt?: number;
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
  frownOpacity: 0,
  expressionMouthOpacity: 0,
  tearOpacity: 0,
  sparkleOpacity: 0,
  blushOpacity: 0,
  browTilt: 0,
  tailTilt: 0,
};

/**
 * Behavior packs stay universal. Adding a character means supplying this adapter:
 * base rig values, how its four legacy facial emotions map, and how abstract
 * performance intent maps to the shared runtime channels.
 */
export interface CharacterPerformanceAdapter {
  readonly id: string;
  readonly base: StandardPerformancePose;
  emotion(emotion: Emotion): Partial<StandardPerformancePose>;
  sample(intent: PerformanceIntent, context: PerformanceSampleContext): StandardPerformancePose;
  applyPattern?(pose: StandardPerformancePose, pattern: string, phase: number): StandardPerformancePose;
}
