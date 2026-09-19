import type { PerformanceIntent } from './behaviorPacks';

export interface PerformanceSampleContext {
  weight: number;
  phase: number;
}

/**
 * Character-specific adapters are intentionally tiny. Behavior packs stay universal;
 * an adapter only translates semantic channels into whatever coordinates/controls
 * a particular rig exposes. Missing anatomy/capabilities can simply be ignored.
 */
export interface CharacterPerformanceAdapter<TPose> {
  readonly id: string;
  sample(intent: PerformanceIntent, context: PerformanceSampleContext): TPose;
}
